import { Worker, Job } from 'bullmq';
import { createBullConnection } from '../config/queues';
import { query } from '../config/database';
import { PLAN_LIMITS } from '@gensmart/shared';
import { chat, ChatMessage, ToolDefinition, ToolCall, type ContentPart, supportsVision } from '../services/llm.service';
import { flushBuffer } from '../services/message-buffer.service';
import { checkLimit, incrementMessages } from '../services/usage.service';
import {
  buildVariableCaptureInstructions,
  captureVariableToolDef,
  handleCaptureVariable,
  AgentVariable,
} from '../services/variable-capture.service';
import { queryKnowledgeBase, hasKnowledgeBase } from '../services/rag.service';
import { executeCustomFunction } from '../services/custom-function.service';
import { connectAndListTools, executeMCPTool, sanitizeName } from '../services/mcp-client.service';
import { redis } from '../config/redis';
import { getIO } from '../config/websocket';
import { sendTextMessage, resolveAccessToken } from '../services/whatsapp.service';
import { getAvailableSlots, localTimeToUTC, resolveCalendarIds } from '../services/calendar.service';
import { createAppointment } from '../services/appointment.service';

// MCP cache TTL: 1 hour
const MCP_TOOLS_CACHE_TTL = 3600;

type PlanKey = keyof typeof PLAN_LIMITS;

interface MessageJobData {
  conversationId: string;
  agentId: string;
  organizationId: string;
}

interface AgentRow {
  id: string;
  organization_id: string;
  name: string;
  system_prompt: string;
  llm_provider: string;
  llm_model: string;
  temperature: string;
  max_tokens: number;
  context_window_messages: number;
  message_buffer_seconds: number;
  variables: AgentVariable[];
  status: string;
  published_at: string | null;
}

interface ToolRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_enabled: boolean;
}

interface ConversationRow {
  id: string;
  agent_id: string;
  organization_id: string;
  contact_id: string | null;
  channel: string;
  status: string;
  captured_variables: Record<string, unknown>;
  message_count: number;
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface OrgRow {
  plan: string;
  byo_openai_key_encrypted: string | null;
  byo_anthropic_key_encrypted: string | null;
}

const MAX_TOOL_ITERATIONS = 5;

interface MCPToolMapping {
  serverUrl: string;
  originalToolName: string;
  transport: 'sse' | 'streamable-http';
}

async function processMessage(job: Job<MessageJobData>): Promise<void> {
  const { conversationId, agentId, organizationId } = job.data;

  // Step 1: Flush buffer atomically
  const bufferedItems = await flushBuffer(conversationId);
  if (!bufferedItems.length) {
    console.log(`[msg-worker] No messages in buffer for ${conversationId}`);
    return;
  }

  // Separate text items and image items
  const textItems = bufferedItems.filter((item) => item.type === 'text');
  const imageItems = bufferedItems.filter((item) => item.type === 'image');
  const hasVoiceTranscription = textItems.some(
    (item) => item.mimeType === 'audio/voice-transcription'
  );

  // Plain text version (for DB storage + display + non-vision fallback)
  const textParts: string[] = [];
  for (const item of textItems) {
    if (item.content) textParts.push(item.content);
  }
  for (const item of imageItems) {
    if (item.content) textParts.push(item.content); // image captions
  }
  const userMessageText = textParts.join('\n') || '[Image]';

  // Step 2: Fetch conversation
  const convResult = await query<ConversationRow>(
    'SELECT id, agent_id, organization_id, contact_id, channel, status, captured_variables, message_count FROM conversations WHERE id = $1',
    [conversationId]
  );
  const conv = convResult.rows[0];
  if (!conv) {
    console.error(`[msg-worker] Conversation not found: ${conversationId}`);
    return;
  }

  // Step 3: If human takeover — save user message + notify dashboard, skip LLM
  if (conv.status === 'human_takeover') {
    console.log(`[msg-worker] Human takeover — saving user message, skipping LLM`);

    const takeoverUserMeta: Record<string, unknown> = {};
    if (imageItems.length > 0) {
      takeoverUserMeta['hasImages'] = true;
      takeoverUserMeta['imageCount'] = imageItems.length;
      takeoverUserMeta['images'] = imageItems.map((img) => ({
        mimeType: img.mimeType,
        data: img.data,
        hasCaption: !!img.content,
      }));
    }

    const msgResult = await query<{ id: string; created_at: string }>(
      `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'user', $2, $3, NOW())
       RETURNING id, created_at`,
      [conversationId, userMessageText, JSON.stringify(takeoverUserMeta)]
    );

    await query(
      `UPDATE conversations SET last_message_at = NOW(), message_count = message_count + $1, updated_at = NOW() WHERE id = $2`,
      [bufferedItems.length, conversationId]
    );

    try {
      const io = getIO();
      const takoverMsg = [{
        id: msgResult.rows[0]!.id,
        role: 'user',
        content: userMessageText,
        metadata: takeoverUserMeta,
        createdAt: msgResult.rows[0]!.created_at,
      }];
      io.to(`org:${organizationId}`).emit('message:new', { conversationId, messages: takoverMsg });
      io.to(`conv:${conversationId}`).emit('message:new', { conversationId, messages: takoverMsg });
      io.to(`org:${organizationId}`).emit('conversation:update', {
        conversationId,
        lastMessage: userMessageText.slice(0, 100),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // WebSocket might not be initialized
    }

    return;
  }

  // Step 4: Fetch org plan and check usage limit
  const orgResult = await query<OrgRow>(
    'SELECT plan, byo_openai_key_encrypted, byo_anthropic_key_encrypted FROM organizations WHERE id = $1',
    [organizationId]
  );
  const org = orgResult.rows[0];
  const plan = (org?.plan ?? 'free') as PlanKey;
  const planLimits = PLAN_LIMITS[plan];

  // Resolve BYO key for Enterprise
  let byoApiKey: string | undefined;
  if (plan === 'enterprise') {
    const { decrypt } = await import('../config/encryption');
    // Will be resolved per provider when calling LLM
    const byoOpenAI = org?.byo_openai_key_encrypted ? decrypt(org.byo_openai_key_encrypted) : undefined;
    const byoAnthropic = org?.byo_anthropic_key_encrypted ? decrypt(org.byo_anthropic_key_encrypted) : undefined;
    // Set temporarily — actual resolution happens below based on provider
    byoApiKey = byoOpenAI ?? byoAnthropic;
    void byoApiKey; // resolved per provider below
  }

  // If BYO key active, skip message limit check
  const hasByoKey = plan === 'enterprise' && (org?.byo_openai_key_encrypted || org?.byo_anthropic_key_encrypted);
  const usageCheck = hasByoKey
    ? { allowed: true, current: 0, limit: 0 }
    : await checkLimit(organizationId, plan);

  if (!usageCheck.allowed) {
    console.log(`[msg-worker] Usage limit reached for org ${organizationId}`);
    // Notify via WebSocket
    try {
      getIO().to(`org:${organizationId}`).emit('usage:limit_reached', {
        conversationId,
        current: usageCheck.current,
        limit: usageCheck.limit,
      });
    } catch {
      // WebSocket might not be initialized in test
    }
    return;
  }

  // Step 5: Fetch agent
  const agentResult = await query<AgentRow>(
    'SELECT id, organization_id, name, system_prompt, llm_provider, llm_model, temperature, max_tokens, context_window_messages, message_buffer_seconds, variables, status, published_at FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, organizationId]
  );
  const agent = agentResult.rows[0];
  if (!agent || agent.status === 'draft') {
    console.error(`[msg-worker] Agent not found or not published: ${agentId}`);
    return;
  }

  // Step 6: Fetch enabled tools
  const toolsResult = await query<ToolRow>(
    'SELECT id, type, name, description, config, is_enabled FROM agent_tools WHERE agent_id = $1 AND is_enabled = true',
    [agentId]
  );
  const agentTools = toolsResult.rows;

  // Step 7: Build context
  const contextWindowMessages = Math.min(
    agent.context_window_messages,
    planLimits.contextWindowMessages
  );
  const maxTokens = Math.min(agent.max_tokens, planLimits.maxTokensPerResponse);

  // 7a. Build system prompt with variable instructions
  const variables = Array.isArray(agent.variables) ? agent.variables : [];
  const variableInstructions = buildVariableCaptureInstructions(variables);
  let fullSystemPrompt = agent.system_prompt;
  if (variableInstructions) {
    fullSystemPrompt += '\n\n' + variableInstructions;
  }

  // 7b. RAG context
  const hasRAG = await hasKnowledgeBase(agentId);
  if (hasRAG) {
    const ragContext = await queryKnowledgeBase(agentId, userMessageText);
    if (ragContext) {
      fullSystemPrompt += '\n\n' + ragContext;
    }
  }

  // 7c. Conversation history
  const historyResult = await query<MessageRow>(
    `SELECT id, role, content, metadata, created_at
     FROM messages
     WHERE conversation_id = $1 AND role IN ('user', 'assistant', 'human', 'system')
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, contextWindowMessages * 2] // fetch more to account for system messages
  );
  const history: ChatMessage[] = historyResult.rows
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'human' ||
      (m.role === 'system' && (m.metadata as Record<string, unknown>)?.['type'] === 'intervention_summary'))
    .slice(-contextWindowMessages)
    .map((m) => ({
      role: m.role === 'human' ? ('assistant' as const) : (m.role === 'system' ? ('assistant' as const) : (m.role as 'user' | 'assistant')),
      content: m.role === 'human'
        ? `[Human agent responded]: ${m.content}`
        : m.role === 'system'
          ? `[Intervention summary]: ${m.content}`
          : m.content,
    }));

  // Step 8: Build tools list for LLM
  const llmTools: ToolDefinition[] = [];

  // Internal: capture_variable (always included if there are variables)
  if (variables.length > 0) {
    llmTools.push(captureVariableToolDef);
  }

  // Custom functions
  for (const tool of agentTools) {
    if (tool.type === 'custom_function' && tool.is_enabled) {
      const cfg = tool.config;

      // Frontend stores params as array: [{name, type, required}, ...]
      // LLM needs JSON Schema: {type:'object', properties:{...}, required:[...]}
      let parameters: Record<string, unknown>;
      const rawParams = cfg['parameters'] ?? cfg['params'];

      if (Array.isArray(rawParams)) {
        const properties: Record<string, { type: string; description: string }> = {};
        const required: string[] = [];
        for (const p of rawParams as Array<{ name: string; type: string; required?: boolean; description?: string }>) {
          if (!p.name) continue;
          properties[p.name] = {
            type: p.type || 'string',
            description: p.description || p.name,
          };
          if (p.required) required.push(p.name);
        }
        parameters = { type: 'object', properties, required };
      } else if (rawParams && typeof rawParams === 'object' && (rawParams as Record<string, unknown>)['type'] === 'object') {
        parameters = rawParams as Record<string, unknown>;
      } else {
        parameters = { type: 'object', properties: {}, required: [] };
      }

      llmTools.push({
        name: tool.name.replace(/\s+/g, '_').toLowerCase(),
        description: tool.description ?? tool.name,
        parameters,
      });
    }

    if (tool.type === 'scheduling' && tool.is_enabled) {
      const calendarIds = resolveCalendarIds(tool.config as Record<string, unknown>);
      const hasMultipleCalendars = calendarIds.length > 1;

      llmTools.push(
        {
          name: 'check_availability',
          description: 'Check available appointment slots for a given date',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Date to check availability (YYYY-MM-DD)' },
              service: { type: 'string', description: 'Service or appointment type' },
              ...(hasMultipleCalendars ? {
                calendar_id: { type: 'string', description: 'ID of the specific calendar to check availability on. Determine the correct calendar based on the conversation context and your instructions.' },
              } : {}),
            },
            required: hasMultipleCalendars ? ['date', 'calendar_id'] : ['date'],
          },
        },
        {
          name: 'book_appointment',
          description: 'Book an appointment for the user',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Appointment date (YYYY-MM-DD)' },
              time: { type: 'string', description: 'Appointment time (HH:MM)' },
              service: { type: 'string', description: 'Service or appointment type' },
              name: { type: 'string', description: 'Customer name' },
              phone: { type: 'string', description: 'Customer phone number' },
              ...(hasMultipleCalendars ? {
                calendar_id: { type: 'string', description: 'ID of the specific calendar to book on. Determine the correct calendar based on the conversation context and your instructions.' },
              } : {}),
            },
            required: hasMultipleCalendars ? ['date', 'time', 'calendar_id'] : ['date', 'time'],
          },
        }
      );
    }
  }

  // MCP tools — load definitions (with Redis cache) and add to llmTools
  const mcpToolMap: Record<string, MCPToolMapping> = {};

  for (const tool of agentTools) {
    if (tool.type !== 'mcp' || !tool.is_enabled) continue;

    const cfg = tool.config as {
      server_url?: string;
      serverUrl?: string;
      name?: string;
      serverName?: string;
      transport?: string;
      selected_tools?: string[];
    };

    const serverUrl = cfg.server_url ?? cfg.serverUrl ?? '';
    const serverName = cfg.name ?? cfg.serverName ?? 'mcp';
    const selectedTools = cfg.selected_tools ?? [];
    const mcpTransport = (cfg.transport === 'streamable-http' ? 'streamable-http' : 'sse') as 'sse' | 'streamable-http';

    if (!serverUrl || selectedTools.length === 0) continue;

    const cacheKey = `mcp:tools:${tool.id}`;

    try {
      // Try Redis cache first
      let toolDefs: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> | null = null;

      const cached = await redis.get(cacheKey).catch(() => null);
      if (cached) {
        try {
          toolDefs = JSON.parse(cached) as typeof toolDefs;
        } catch {
          toolDefs = null;
        }
      }

      if (!toolDefs) {
        // Fetch from MCP server
        const fetched = await connectAndListTools(serverUrl, mcpTransport);
        toolDefs = fetched;
        // Cache for 1 hour
        await redis.setex(cacheKey, MCP_TOOLS_CACHE_TTL, JSON.stringify(toolDefs)).catch(() => {});
      }

      const sanitizedServerName = sanitizeName(serverName);

      for (const toolDef of toolDefs) {
        // Only include selected tools
        if (!selectedTools.includes(toolDef.name)) continue;

        const prefixedName = `mcp_${sanitizedServerName}_${sanitizeName(toolDef.name)}`;

        llmTools.push({
          name: prefixedName,
          description: `[MCP:${serverName}] ${toolDef.description}`,
          parameters: toolDef.inputSchema as ToolDefinition['parameters'],
        });

        mcpToolMap[prefixedName] = { serverUrl, originalToolName: toolDef.name, transport: mcpTransport };
      }
    } catch (err) {
      // Graceful degradation: log but continue without MCP tools
      console.error(`[msg-worker] Failed to load MCP tools for tool ${tool.id}:`, (err as Error).message);
    }
  }

  // Add scheduling instructions if a scheduling tool is enabled
  if (agentTools.some((t) => t.type === 'scheduling')) {
    const todayDate = new Date().toISOString().split('T')[0];
    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const currentYear = new Date().getFullYear();

    const schedulingTool = agentTools.find((t) => t.type === 'scheduling');
    const calendarIds = schedulingTool ? resolveCalendarIds(schedulingTool.config as Record<string, unknown>) : [];

    if (calendarIds.length > 1) {
      const calResult = await query<{ id: string; name: string }>(
        'SELECT id, name FROM calendars WHERE id = ANY($1::uuid[])',
        [calendarIds]
      );
      const calList = calResult.rows.map((c) => `- "${c.name}" → calendar_id: ${c.id}`).join('\n');

      fullSystemPrompt += `\n\nToday's date is ${todayDate} (${todayDay}). Always use the current year (${currentYear}) when interpreting user-mentioned dates and always output dates in YYYY-MM-DD format.\n\nYou have access to a scheduling system with multiple calendars:\n${calList}\n\nIMPORTANT: Use your system prompt instructions and the conversation context to determine which calendar to use. Do NOT ask the user which calendar or doctor — infer it from the conversation logic defined in your prompt. When calling check_availability or book_appointment, you MUST include the correct calendar_id based on your reasoning.\n\nScheduling flow:\n1. Determine the correct calendar based on conversation context and your prompt rules\n2. Call check_availability with the date AND the calendar_id\n3. Present the available slots to the user\n4. When the user confirms a slot, call book_appointment with date, time, name, and calendar_id`;
    } else {
      fullSystemPrompt += `\n\nToday's date is ${todayDate} (${todayDay}). Always use the current year (${currentYear}) when interpreting user-mentioned dates and always output dates in YYYY-MM-DD format.\n\nYou have access to a scheduling system. When the user wants to book an appointment:\n1. First call check_availability with the requested date (YYYY-MM-DD, year ${currentYear}) to see available time slots\n2. Present the available slots to the user\n3. When the user confirms a slot, call book_appointment with the date, time, and the user's name`;
    }
  }

  // Resolve BYO API key for this agent's provider (Enterprise only)
  let resolvedByoKey: string | undefined;
  if (plan === 'enterprise') {
    const { decrypt: decryptKey } = await import('../config/encryption');
    const provider = agent.llm_provider as 'openai' | 'anthropic';
    if (provider === 'openai' && org?.byo_openai_key_encrypted) {
      try { resolvedByoKey = decryptKey(org.byo_openai_key_encrypted); } catch { /* invalid key */ }
    } else if (provider === 'anthropic' && org?.byo_anthropic_key_encrypted) {
      try { resolvedByoKey = decryptKey(org.byo_anthropic_key_encrypted); } catch { /* invalid key */ }
    }
  }

  // Step 9: LLM call with tool loop — build vision-aware user content
  const hasImages = imageItems.length > 0;
  const modelSupportsVision = supportsVision(agent.llm_provider, agent.llm_model);

  let userContent: string | ContentPart[];

  if (hasImages && modelSupportsVision) {
    const parts: ContentPart[] = [];
    const combinedText = textParts.join('\n');
    if (combinedText) {
      parts.push({ type: 'text', text: combinedText });
    }
    for (const img of imageItems) {
      if (img.data && img.mimeType) {
        parts.push({ type: 'image', mimeType: img.mimeType, data: img.data });
      }
    }
    if (!combinedText) {
      parts.unshift({ type: 'text', text: 'The user sent this image. Please analyze it and respond appropriately.' });
    }
    userContent = parts;
  } else if (hasImages && !modelSupportsVision) {
    const imageNote = imageItems.length === 1
      ? '[The user sent an image, but the current AI model does not support image analysis. Please let them know.]'
      : `[The user sent ${imageItems.length} images, but the current AI model does not support image analysis. Please let them know.]`;
    const combinedText = textParts.join('\n');
    userContent = combinedText ? `${combinedText}\n\n${imageNote}` : imageNote;
  } else {
    userContent = userMessageText;
  }

  const messages: ChatMessage[] = [...history, { role: 'user', content: userContent }];

  let finalResponse = '';
  let totalTokensUsed = 0;
  const toolsCalledLog: string[] = [];
  let iterationCount = 0;

  try {
    let currentMessages = [...messages];

    while (iterationCount < MAX_TOOL_ITERATIONS) {
      iterationCount++;

      const response = await chat({
        provider: agent.llm_provider as 'openai' | 'anthropic',
        model: agent.llm_model,
        system: fullSystemPrompt,
        messages: currentMessages,
        tools: llmTools.length > 0 ? llmTools : undefined,
        temperature: parseFloat(agent.temperature),
        maxTokens,
        byoApiKey: resolvedByoKey,
      });

      totalTokensUsed += response.usage.totalTokens;

      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Final text response
        finalResponse = response.content;
        break;
      }

      // Process tool calls
      const toolResults: Array<{ toolCallId: string; content: string }> = [];

      for (const toolCall of response.toolCalls) {
        const result = await executeTool(
          toolCall,
          agentTools,
          variables,
          conversationId,
          organizationId,
          mcpToolMap
        );
        toolsCalledLog.push(`${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
        toolResults.push({ toolCallId: toolCall.id, content: result });
      }

      // Append the assistant's tool call message with structured tool call data
      currentMessages.push({
        role: 'assistant' as const,
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      // Add tool results as a single structured message
      currentMessages.push({
        role: 'user' as const,
        content: '',
        toolResults: toolResults.map((r) => ({
          toolCallId: r.toolCallId,
          content: r.content,
        })),
      });

      // If LLM also returned text alongside tool calls, keep it
      if (response.content.trim()) {
        finalResponse = response.content;
      }
    }
  } catch (err) {
    // Retry once
    try {
      const retryResponse = await chat({
        provider: agent.llm_provider as 'openai' | 'anthropic',
        model: agent.llm_model,
        system: fullSystemPrompt,
        messages,
        temperature: parseFloat(agent.temperature),
        maxTokens,
        byoApiKey: resolvedByoKey,
      });
      finalResponse = retryResponse.content;
      totalTokensUsed = retryResponse.usage.totalTokens;
    } catch (retryErr) {
      console.error('[msg-worker] LLM failed after retry:', retryErr);
      // Save error message
      const errorMessage = 'I encountered an error processing your message. Please try again.';
      const errorMeta = { error: true, errorMessage: (retryErr as Error).message };
      const errorSaved = await saveMessages(conversationId, userMessageText, errorMessage, errorMeta);
      await updateConversation(conversationId, 2);
      notifyClients(organizationId, conversationId, userMessageText, errorMessage, errorSaved, errorMeta);
      return;
    }
  }

  if (!finalResponse.trim()) {
    finalResponse = '...';
  }

  // Step 10: Save messages
  const msgMetadata: Record<string, unknown> = {
    tokensUsed: totalTokensUsed,
    toolsCalled: toolsCalledLog,
    model: agent.llm_model,
    latencyMs: 0,
  };

  const userMsgMeta: Record<string, unknown> = {};
  if (hasImages) {
    userMsgMeta['hasImages'] = true;
    userMsgMeta['imageCount'] = imageItems.length;
    userMsgMeta['images'] = imageItems.map((img) => ({
      mimeType: img.mimeType,
      data: img.data,
      hasCaption: !!img.content,
    }));
  }
  if (hasVoiceTranscription) {
    userMsgMeta['isVoiceMessage'] = true;
  }

  const savedMessages = await saveMessages(
    conversationId,
    userMessageText,
    finalResponse,
    msgMetadata,
    Object.keys(userMsgMeta).length > 0 ? userMsgMeta : undefined
  );

  // Step 11: Update conversation stats
  await updateConversation(conversationId, bufferedItems.length + 1);

  // Step 12: Increment usage counter (skip for Enterprise BYO key users)
  if (!hasByoKey) {
    await incrementMessages(organizationId);
  }

  // Step 13: Emit WebSocket events
  notifyClients(organizationId, conversationId, userMessageText, finalResponse, savedMessages, msgMetadata);

  // Step 14b: Trigger AI scoring after enough messages (threshold: 6)
  const updatedMessageCount = (conv.message_count ?? 0) + bufferedItems.length + 1;
  if (updatedMessageCount >= 6) {
    try {
      const scoreCheck = await query<{ ai_score: number | null }>(
        'SELECT ai_score FROM conversations WHERE id = $1',
        [conversationId]
      );
      if (scoreCheck.rows[0]?.ai_score === null) {
        const { scoringQueue } = await import('../config/queues');
        await scoringQueue.add(
          'score-conversation',
          { conversationId, organizationId, trigger: 'message_threshold' },
          { delay: 5000, jobId: `score-${conversationId}` }
        );
      }
    } catch (err) {
      console.warn('[msg-worker] Could not enqueue scoring job:', (err as Error).message);
    }
  }

  // Step 14: Send via channel
  if (conv.channel === 'whatsapp') {
    try {
      const agentWaResult = await query<{ whatsapp_config: Record<string, unknown> }>(
        'SELECT whatsapp_config FROM agents WHERE id = $1',
        [agentId]
      );
      const waConfig = agentWaResult.rows[0]?.whatsapp_config;

      if (waConfig?.connected && waConfig?.phone_number_id) {
        const contactResult = await query<{ phone: string | null }>(
          'SELECT phone FROM contacts WHERE id = $1',
          [conv.contact_id]
        );
        const phone = contactResult.rows[0]?.phone;

        if (phone) {
          const accessToken = await resolveAccessToken(waConfig);
          await sendTextMessage(String(waConfig.phone_number_id), accessToken, phone, finalResponse);
          console.log(`[msg-worker] WhatsApp message sent to ${phone.slice(0, 4)}*** conv: ${conversationId}`);
        } else {
          console.warn(`[msg-worker] No phone for contact — conv: ${conversationId}`);
        }
      } else {
        console.warn(`[msg-worker] WhatsApp not configured for agent ${agentId}`);
      }
    } catch (err) {
      console.error(`[msg-worker] WhatsApp send error for conv ${conversationId}:`, (err as Error).message);
    }
  } else if (conv.channel === 'web') {
    // Web widget notification via WebSocket (room per session)
    try {
      getIO().to(`conv:${conversationId}`).emit('message:new', {
        conversationId,
        role: 'assistant',
        content: finalResponse,
      });
    } catch {
      // WebSocket might not be initialized
    }
  }
}

async function executeTool(
  toolCall: ToolCall,
  agentTools: ToolRow[],
  variables: AgentVariable[],
  conversationId: string,
  organizationId: string,
  mcpToolMap: Record<string, MCPToolMapping> = {}
): Promise<string> {
  const { name, arguments: args } = toolCall;

  // MCP tools (prefixed with mcp_)
  if (name.startsWith('mcp_') && mcpToolMap[name]) {
    const { serverUrl, originalToolName, transport } = mcpToolMap[name];
    const result = await executeMCPTool(serverUrl, originalToolName, args, transport);
    return result.content;
  }

  // Internal tool: capture_variable
  if (name === 'capture_variable') {
    const varName = String(args['variable_name'] ?? '');
    const varValue = String(args['variable_value'] ?? '');
    try {
      const io = getIO();
      const result = await handleCaptureVariable(conversationId, varName, varValue, variables, io);
      return result.message;
    } catch {
      const result = await handleCaptureVariable(conversationId, varName, varValue, variables);
      return result.message;
    }
  }

  // Scheduling tool — check available slots
  if (name === 'check_availability') {
    const date = String(args['date'] ?? '');
    if (!date) return 'Please provide a date in YYYY-MM-DD format.';

    // Multi-calendar: prefer calendar_id from LLM args, fallback to first in config
    let calendarId = String(args['calendar_id'] ?? '');
    if (!calendarId) {
      const schedulingTool = agentTools.find((t) => t.type === 'scheduling');
      const calIds = schedulingTool ? resolveCalendarIds(schedulingTool.config as Record<string, unknown>) : [];
      calendarId = calIds[0] ?? '';
    }

    if (!calendarId) {
      return 'No calendar configured for this agent.';
    }

    try {
      const slots = await getAvailableSlots(calendarId, date);
      if (!slots.length) {
        return `No available slots found for ${date}. Please try a different date.`;
      }
      const slotList = slots.map((s) => s.start).join(', ');
      return `Available slots for ${date}: ${slotList}. Which time works best for you?`;
    } catch {
      return `Could not check availability for ${date}. Please try again.`;
    }
  }

  // Scheduling tool — book appointment
  if (name === 'book_appointment') {
    const date = String(args['date'] ?? '');
    const time = String(args['time'] ?? '');
    const personName = String(args['name'] ?? 'Guest');

    if (!date || !time) return 'Please provide both date and time for the appointment.';

    // Multi-calendar: prefer calendar_id from LLM args, fallback to first in config
    let calendarId = String(args['calendar_id'] ?? '');
    if (!calendarId) {
      const schedulingTool = agentTools.find((t) => t.type === 'scheduling');
      const calIds = schedulingTool ? resolveCalendarIds(schedulingTool.config as Record<string, unknown>) : [];
      calendarId = calIds[0] ?? '';
    }

    if (!calendarId) {
      return 'No calendar configured for this agent.';
    }

    // Get slot duration and timezone from calendar
    let slotDuration = 30;
    let calendarTimezone = 'UTC';
    try {
      const { query: dbQuery } = await import('../config/database');
      const calResult = await dbQuery<{ slot_duration: number; timezone: string }>(
        'SELECT slot_duration, timezone FROM calendars WHERE id = $1',
        [calendarId]
      );
      if (calResult.rows[0]) {
        slotDuration = calResult.rows[0].slot_duration;
        calendarTimezone = calResult.rows[0].timezone || 'UTC';
      }
    } catch {
      // use defaults
    }

    // Find or look up contact for this conversation
    let contactId: string | null = null;
    try {
      const { query: dbQuery } = await import('../config/database');
      const convResult = await dbQuery<{ contact_id: string | null }>(
        'SELECT contact_id FROM conversations WHERE id = $1',
        [conversationId]
      );
      contactId = convResult.rows[0]?.contact_id ?? null;
    } catch {
      // ignore
    }

    // Convert local calendar time → UTC for storage
    const startUTC = localTimeToUTC(date, time, calendarTimezone);
    const startTime = startUTC.toISOString();
    const endTime = new Date(startUTC.getTime() + slotDuration * 60000).toISOString();

    try {
      await createAppointment(organizationId, {
        calendarId,
        contactId,
        conversationId,
        title: `Appointment — ${personName}`,
        startTime,
        endTime,
      });

      // Generate AI summary of the conversation for notification emails
      let meetingSummary = '';
      try {
        const summaryMessages = await query<{ role: string; content: string }>(
          `SELECT role, content FROM messages
           WHERE conversation_id = $1 AND role IN ('user', 'assistant', 'human')
           ORDER BY created_at DESC LIMIT 20`,
          [conversationId]
        );

        if (summaryMessages.rows.length > 0) {
          const transcript = summaryMessages.rows
            .reverse()
            .map((m) => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
            .join('\n');

          const { chat: llmChat } = await import('../services/llm.service');
          const summaryResponse = await llmChat({
            provider: 'openai',
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: `Based on this conversation, write a brief 2-3 sentence summary of what this upcoming meeting will be about. Focus on the customer's needs, interests, and any specific topics they want to discuss. Write in the same language the conversation was held in.\n\nConversation:\n${transcript}\n\nMeeting summary:`,
            }],
            temperature: 0.3,
            maxTokens: 150,
          });
          meetingSummary = summaryResponse.content.trim();
        }
      } catch (summaryErr) {
        console.error('[worker] Failed to generate meeting summary:', summaryErr);
        // Non-fatal — continue without summary
      }

      // Send email notification to calendar owner
      try {
        const calNotifResult = await query<{ notification_email: string | null; name: string }>(
          'SELECT notification_email, name FROM calendars WHERE id = $1',
          [calendarId]
        );
        const notifEmail = calNotifResult.rows[0]?.notification_email;
        const calName = calNotifResult.rows[0]?.name || 'Calendar';
        if (notifEmail) {
          const { sendEmail, emailTemplate, getFrontendUrl } = await import('../config/email');
          await sendEmail({
            to: notifEmail,
            subject: `New Appointment: ${personName} — ${date} at ${time}`,
            html: emailTemplate(
              `<h2 style="margin:0 0 16px">New Appointment Booked</h2>
               <p><strong>Calendar:</strong> ${calName}</p>
               <p><strong>Client:</strong> ${personName}</p>
               <p><strong>Date:</strong> ${date}</p>
               <p><strong>Time:</strong> ${time}</p>
               <p><strong>Phone:</strong> ${String(args['phone'] ?? 'Not provided')}</p>
               ${meetingSummary ? `<p style="margin-top:12px;padding:12px;background:#f0fdf4;border-radius:8px;border-left:3px solid #25D366;font-size:14px;color:#1A1A1A;line-height:1.5;"><strong>Meeting topic:</strong><br/>${meetingSummary}</p>` : ''}
               <p style="margin-top:16px"><a href="${getFrontendUrl()}/dashboard/calendar" style="background:#25D366;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">View Calendar</a></p>`
            ),
          });
        }
      } catch (emailErr) {
        console.error('[worker] Failed to send appointment notification email:', emailErr);
      }

      // Send confirmation email to the end user (if email was captured)
      try {
        const contactEmailResult = await query<{ email: string | null; name: string | null }>(
          `SELECT co.email, co.name FROM contacts co
           JOIN conversations cv ON cv.contact_id = co.id
           WHERE cv.id = $1`,
          [conversationId]
        );
        const contactEmail = contactEmailResult.rows[0]?.email;
        const contactName = contactEmailResult.rows[0]?.name || personName;

        if (contactEmail) {
          const { sendEmail, emailTemplate } = await import('../config/email');

          const calNameResult = await query<{ name: string }>(
            'SELECT name FROM calendars WHERE id = $1',
            [calendarId]
          );
          const calName = calNameResult.rows[0]?.name || 'Calendar';
          const summaryText = meetingSummary || 'Your appointment has been scheduled successfully.';

          await sendEmail({
            to: contactEmail,
            subject: `Your Appointment is Confirmed — ${date} at ${time}`,
            html: emailTemplate(
              `<h2 style="margin:0 0 16px;color:#1A1A1A;">Your Appointment is Confirmed! ✓</h2>
               <p style="color:#6B7280;font-size:15px;line-height:1.6;">Hi ${contactName}, your appointment has been booked. Here are the details:</p>
               <div style="background:#FFFFFF;border:1px solid #E5E0DB;border-radius:8px;padding:20px;margin:20px 0;">
                 <table style="width:100%;border-collapse:collapse;">
                   <tr><td style="color:#6B7280;font-size:14px;padding:6px 0;width:80px;">Date</td><td style="color:#1A1A1A;font-weight:600;padding:6px 0;">${date}</td></tr>
                   <tr><td style="color:#6B7280;font-size:14px;padding:6px 0;">Time</td><td style="color:#1A1A1A;font-weight:600;padding:6px 0;">${time}</td></tr>
                   <tr><td style="color:#6B7280;font-size:14px;padding:6px 0;">Calendar</td><td style="color:#1A1A1A;padding:6px 0;">${calName}</td></tr>
                 </table>
               </div>
               <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid #25D366;">
                 <p style="margin:0 0 8px;font-weight:600;color:#1A1A1A;font-size:14px;">What we'll discuss:</p>
                 <p style="margin:0;color:#374151;font-size:14px;line-height:1.5;">${summaryText}</p>
               </div>
               <div style="background:#FAF8F5;border-radius:8px;padding:16px;margin:16px 0;">
                 <p style="margin:0 0 10px;font-weight:600;color:#1A1A1A;font-size:14px;">Before your appointment:</p>
                 <table style="border-collapse:collapse;">
                   <tr><td style="padding:4px 8px 4px 0;color:#25D366;font-size:16px;">✓</td><td style="padding:4px 0;color:#374151;font-size:14px;">Note down any questions you want to ask</td></tr>
                   <tr><td style="padding:4px 8px 4px 0;color:#25D366;font-size:16px;">✓</td><td style="padding:4px 0;color:#374151;font-size:14px;">Have relevant documents or information ready</td></tr>
                   <tr><td style="padding:4px 8px 4px 0;color:#25D366;font-size:16px;">✓</td><td style="padding:4px 0;color:#374151;font-size:14px;">Be available a few minutes before the scheduled time</td></tr>
                 </table>
               </div>
               <p style="color:#9CA3AF;font-size:12px;margin-top:20px;">If you need to reschedule, please contact us directly.</p>`
            ),
          });
          console.log(`[worker] Confirmation email sent to end user: ${contactEmail}`);
        }
      } catch (userEmailErr) {
        console.error('[worker] Failed to send user confirmation email:', userEmailErr);
        // Non-fatal — booking is already confirmed
      }

      return `Appointment confirmed for ${date} at ${time}. We look forward to seeing you, ${personName}!`;
    } catch (err) {
      return `Could not book the appointment: ${(err as Error).message}. Please choose another slot.`;
    }
  }

  // Custom function tools
  const toolDef = agentTools.find(
    (t) => t.type === 'custom_function' && t.name.replace(/\s+/g, '_').toLowerCase() === name
  );

  if (toolDef) {
    try {
      return await executeCustomFunction(
        toolDef.config as unknown as Parameters<typeof executeCustomFunction>[0],
        args
      );
    } catch (err) {
      return `Error executing ${name}: ${(err as Error).message}`;
    }
  }

  return `Tool ${name} is not available.`;
}

interface SavedMessages {
  userMsgId: string;
  assistantMsgId: string;
  userCreatedAt: string;
  assistantCreatedAt: string;
}

async function saveMessages(
  conversationId: string,
  userMessage: string,
  assistantMessage: string,
  metadata: Record<string, unknown>,
  userMetadata?: Record<string, unknown>
): Promise<SavedMessages> {
  const userResult = await query<{ id: string; created_at: string }>(
    `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
     VALUES ($1, 'user', $2, $3, NOW())
     RETURNING id, created_at`,
    [conversationId, userMessage, JSON.stringify(userMetadata ?? {})]
  );
  const assistantResult = await query<{ id: string; created_at: string }>(
    `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
     VALUES ($1, 'assistant', $2, $3, NOW())
     RETURNING id, created_at`,
    [conversationId, assistantMessage, JSON.stringify(metadata)]
  );
  return {
    userMsgId: userResult.rows[0]!.id,
    assistantMsgId: assistantResult.rows[0]!.id,
    userCreatedAt: userResult.rows[0]!.created_at,
    assistantCreatedAt: assistantResult.rows[0]!.created_at,
  };
}

async function updateConversation(conversationId: string, messageDelta: number): Promise<void> {
  await query(
    `UPDATE conversations
     SET last_message_at = NOW(),
         message_count = message_count + $1,
         updated_at = NOW()
     WHERE id = $2`,
    [messageDelta, conversationId]
  );
}

function notifyClients(
  organizationId: string,
  conversationId: string,
  userMessage: string,
  assistantMessage: string,
  savedMessages?: SavedMessages,
  metadata?: Record<string, unknown>
): void {
  try {
    const io = getIO();
    const msgPayload = {
      conversationId,
      messages: [
        {
          id: savedMessages?.userMsgId,
          role: 'user',
          content: userMessage,
          createdAt: savedMessages?.userCreatedAt,
        },
        {
          id: savedMessages?.assistantMsgId,
          role: 'assistant',
          content: assistantMessage,
          metadata,
          createdAt: savedMessages?.assistantCreatedAt,
        },
      ],
    };
    const updatePayload = {
      conversationId,
      lastMessage: assistantMessage.slice(0, 100),
      updatedAt: new Date().toISOString(),
    };
    // Emit to both org room (conversation list) and conv room (detail page)
    io.to(`org:${organizationId}`).emit('message:new', msgPayload);
    io.to(`conv:${conversationId}`).emit('message:new', msgPayload);
    io.to(`org:${organizationId}`).emit('conversation:update', updatePayload);
  } catch {
    // WebSocket might not be initialized
  }
}

export function startMessageWorker(): Worker<MessageJobData> {
  const worker = new Worker<MessageJobData>('message-processing', processMessage, {
    connection: createBullConnection(),
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[msg-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[msg-worker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
