import { Worker, Job } from 'bullmq';
import { createBullConnection } from '../config/queues';
import { query } from '../config/database';
import { PLAN_LIMITS } from '@gensmart/shared';
import { chat, ChatMessage, ToolDefinition, ToolCall } from '../services/llm.service';
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
import { getIO } from '../config/websocket';
import { sendTextMessage, decryptAccessToken } from '../services/whatsapp.service';

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
}

const MAX_TOOL_ITERATIONS = 5;

async function processMessage(job: Job<MessageJobData>): Promise<void> {
  const { conversationId, agentId, organizationId } = job.data;

  // Step 1: Flush buffer atomically
  const bufferedMessages = await flushBuffer(conversationId);
  if (!bufferedMessages.length) {
    console.log(`[msg-worker] No messages in buffer for ${conversationId}`);
    return;
  }
  const userMessage = bufferedMessages.join('\n');

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

  // Step 3: Skip if human takeover
  if (conv.status === 'human_takeover') {
    console.log(`[msg-worker] Skipping — conversation ${conversationId} is in human takeover`);
    return;
  }

  // Step 4: Fetch org plan and check usage limit
  const orgResult = await query<OrgRow>(
    'SELECT plan FROM organizations WHERE id = $1',
    [organizationId]
  );
  const org = orgResult.rows[0];
  const plan = (org?.plan ?? 'free') as PlanKey;
  const planLimits = PLAN_LIMITS[plan];

  const usageCheck = await checkLimit(organizationId, plan);
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
    const ragContext = await queryKnowledgeBase(agentId, userMessage);
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
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'human')
    .slice(-contextWindowMessages)
    .map((m) => ({
      role: m.role === 'human' ? ('user' as const) : (m.role as 'user' | 'assistant'),
      content: m.content,
    }));

  // Step 8: Build tools list for LLM
  const llmTools: ToolDefinition[] = [];

  // Internal: capture_variable (always included if there are variables)
  if (variables.length > 0) {
    llmTools.push(captureVariableToolDef);
  }

  // Custom functions
  for (const tool of agentTools) {
    if (tool.type === 'custom_function') {
      const cfg = tool.config;
      const parameters = (cfg['parameters'] as Record<string, unknown>) ?? {
        type: 'object',
        properties: {},
        required: [],
      };
      llmTools.push({
        name: tool.name.replace(/\s+/g, '_').toLowerCase(),
        description: tool.description ?? tool.name,
        parameters,
      });
    }

    if (tool.type === 'scheduling') {
      llmTools.push(
        {
          name: 'check_availability',
          description: 'Check available appointment slots for a given date',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Date to check availability (YYYY-MM-DD)' },
              service: { type: 'string', description: 'Service or appointment type' },
            },
            required: ['date'],
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
            },
            required: ['date', 'time'],
          },
        }
      );
    }
  }

  // Step 9: LLM call with tool loop
  const messages: ChatMessage[] = [...history, { role: 'user', content: userMessage }];

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
          conversationId
        );
        toolsCalledLog.push(`${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
        toolResults.push({ toolCallId: toolCall.id, content: result });
      }

      // Append assistant message with tool calls + tool results to history
      // For next iteration, add tool_results as user messages (simplified)
      for (const result of toolResults) {
        currentMessages.push({
          role: 'user' as const,
          content: `[Tool result for ${result.toolCallId}]: ${result.content}`,
        });
      }

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
      });
      finalResponse = retryResponse.content;
      totalTokensUsed = retryResponse.usage.totalTokens;
    } catch (retryErr) {
      console.error('[msg-worker] LLM failed after retry:', retryErr);
      // Save error message
      const errorMessage = 'I encountered an error processing your message. Please try again.';
      await saveMessages(conversationId, userMessage, errorMessage, {
        error: true,
        errorMessage: (retryErr as Error).message,
      });
      await updateConversation(conversationId, 2);
      notifyClients(organizationId, conversationId, userMessage, errorMessage);
      return;
    }
  }

  if (!finalResponse.trim()) {
    finalResponse = '...';
  }

  // Step 10: Save messages
  await saveMessages(conversationId, userMessage, finalResponse, {
    tokensUsed: totalTokensUsed,
    toolsCalled: toolsCalledLog,
    model: agent.llm_model,
    latencyMs: 0, // Could add timing if needed
  });

  // Step 11: Update conversation stats
  await updateConversation(conversationId, bufferedMessages.length + 1);

  // Step 12: Increment usage counter
  await incrementMessages(organizationId);

  // Step 13: Emit WebSocket events
  notifyClients(organizationId, conversationId, userMessage, finalResponse);

  // Step 14: Send via channel
  if (conv.channel === 'whatsapp') {
    try {
      const agentWaResult = await query<{ whatsapp_config: Record<string, unknown> }>(
        'SELECT whatsapp_config FROM agents WHERE id = $1',
        [agentId]
      );
      const waConfig = agentWaResult.rows[0]?.whatsapp_config;

      if (waConfig?.connected && waConfig?.phone_number_id && waConfig?.access_token_encrypted) {
        const contactResult = await query<{ phone: string | null }>(
          'SELECT phone FROM contacts WHERE id = $1',
          [conv.contact_id]
        );
        const phone = contactResult.rows[0]?.phone;

        if (phone) {
          const accessToken = decryptAccessToken(String(waConfig.access_token_encrypted));
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
  conversationId: string
): Promise<string> {
  const { name, arguments: args } = toolCall;

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

  // Calendar stubs — Phase 7 will implement fully
  if (name === 'check_availability') {
    const date = String(args['date'] ?? 'unspecified');
    return `Available slots for ${date}: 9:00 AM, 10:00 AM, 2:00 PM, 3:00 PM, 4:00 PM. (Calendar integration coming soon)`;
  }

  if (name === 'book_appointment') {
    const date = String(args['date'] ?? '');
    const time = String(args['time'] ?? '');
    const service = String(args['service'] ?? 'appointment');
    return `Appointment booked for ${date} at ${time} (${service}). Confirmation will be sent shortly. (Calendar integration coming soon)`;
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

async function saveMessages(
  conversationId: string,
  userMessage: string,
  assistantMessage: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await query(
    `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
     VALUES ($1, 'user', $2, '{}', NOW()),
            ($1, 'assistant', $3, $4, NOW())`,
    [conversationId, userMessage, assistantMessage, JSON.stringify(metadata)]
  );
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
  assistantMessage: string
): void {
  try {
    const io = getIO();
    // Notify dashboard
    io.to(`org:${organizationId}`).emit('conversation:update', {
      conversationId,
      lastMessage: assistantMessage.slice(0, 100),
      updatedAt: new Date().toISOString(),
    });
    io.to(`org:${organizationId}`).emit('message:new', {
      conversationId,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantMessage },
      ],
    });
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
