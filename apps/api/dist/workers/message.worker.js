"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMessageWorker = startMessageWorker;
const bullmq_1 = require("bullmq");
const queues_1 = require("../config/queues");
const database_1 = require("../config/database");
const shared_1 = require("@gensmart/shared");
const llm_service_1 = require("../services/llm.service");
const message_buffer_service_1 = require("../services/message-buffer.service");
const usage_service_1 = require("../services/usage.service");
const variable_capture_service_1 = require("../services/variable-capture.service");
const rag_service_1 = require("../services/rag.service");
const custom_function_service_1 = require("../services/custom-function.service");
const mcp_client_service_1 = require("../services/mcp-client.service");
const mcp_headers_service_1 = require("../services/mcp-headers.service");
const mcpProviders = __importStar(require("../services/mcp-providers.service"));
const encryption_1 = require("../config/encryption");
const redis_1 = require("../config/redis");
const websocket_1 = require("../config/websocket");
const whatsapp_service_1 = require("../services/whatsapp.service");
const send_media_service_1 = require("../services/send-media.service");
const send_email_notification_service_1 = require("../services/send-email-notification.service");
const calendar_service_1 = require("../services/calendar.service");
const agent_config_service_1 = require("../services/agent-config.service");
const appointment_service_1 = require("../services/appointment.service");
const text_1 = require("../utils/text");
// MCP cache TTL: 1 hour
const MCP_TOOLS_CACHE_TTL = 3600;
const MAX_TOOL_ITERATIONS = 5;
async function processMessage(job) {
    const { conversationId, agentId, organizationId } = job.data;
    // Step 1: Flush buffer atomically
    const bufferedItems = await (0, message_buffer_service_1.flushBuffer)(conversationId);
    if (!bufferedItems.length) {
        console.log(`[msg-worker] No messages in buffer for ${conversationId}`);
        return;
    }
    // Separate text items and image items
    const textItems = bufferedItems.filter((item) => item.type === 'text');
    const imageItems = bufferedItems.filter((item) => item.type === 'image');
    const hasVoiceTranscription = textItems.some((item) => item.mimeType === 'audio/voice-transcription');
    // Plain text version (for DB storage + display + non-vision fallback)
    const textParts = [];
    for (const item of textItems) {
        if (item.content)
            textParts.push(item.content);
    }
    for (const item of imageItems) {
        if (item.content)
            textParts.push(item.content); // image captions
    }
    const userMessageText = textParts.join('\n') || '[Image]';
    // Step 2: Fetch conversation
    const convResult = await (0, database_1.query)('SELECT id, agent_id, organization_id, contact_id, channel, status, captured_variables, message_count FROM conversations WHERE id = $1', [conversationId]);
    const conv = convResult.rows[0];
    if (!conv) {
        console.error(`[msg-worker] Conversation not found: ${conversationId}`);
        return;
    }
    // Step 3: If human takeover — save user message + notify dashboard, skip LLM
    if (conv.status === 'human_takeover') {
        console.log(`[msg-worker] Human takeover — saving user message, skipping LLM`);
        const takeoverUserMeta = {};
        if (imageItems.length > 0) {
            takeoverUserMeta['hasImages'] = true;
            takeoverUserMeta['imageCount'] = imageItems.length;
            takeoverUserMeta['images'] = imageItems.map((img) => ({
                mimeType: img.mimeType,
                data: img.data,
                hasCaption: !!img.content,
            }));
        }
        const msgResult = await (0, database_1.query)(`INSERT INTO messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'user', $2, $3, NOW())
       RETURNING id, created_at`, [conversationId, userMessageText, JSON.stringify(takeoverUserMeta)]);
        await (0, database_1.query)(`UPDATE conversations SET last_message_at = NOW(), message_count = message_count + $1, updated_at = NOW() WHERE id = $2`, [bufferedItems.length, conversationId]);
        try {
            const io = (0, websocket_1.getIO)();
            const takoverMsg = [{
                    id: msgResult.rows[0].id,
                    role: 'user',
                    content: userMessageText,
                    metadata: takeoverUserMeta,
                    createdAt: msgResult.rows[0].created_at,
                }];
            io.to(`org:${organizationId}`).emit('message:new', { conversationId, messages: takoverMsg });
            io.to(`conv:${conversationId}`).emit('message:new', { conversationId, messages: takoverMsg });
            io.to(`org:${organizationId}`).emit('conversation:update', {
                conversationId,
                lastMessage: userMessageText.slice(0, 100),
                updatedAt: new Date().toISOString(),
            });
        }
        catch {
            // WebSocket might not be initialized
        }
        return;
    }
    // Step 4: Fetch org plan and check usage limit
    const orgResult = await (0, database_1.query)('SELECT plan, byo_openai_key_encrypted, byo_anthropic_key_encrypted FROM organizations WHERE id = $1', [organizationId]);
    const org = orgResult.rows[0];
    const plan = (org?.plan ?? 'free');
    const planLimits = shared_1.PLAN_LIMITS[plan];
    // Resolve BYO key for Enterprise
    let byoApiKey;
    if (plan === 'enterprise') {
        const { decrypt } = await Promise.resolve().then(() => __importStar(require('../config/encryption')));
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
        : await (0, usage_service_1.checkLimit)(organizationId, plan);
    if (!usageCheck.allowed) {
        console.log(`[msg-worker] Usage limit reached for org ${organizationId}`);
        // Notify via WebSocket
        try {
            (0, websocket_1.getIO)().to(`org:${organizationId}`).emit('usage:limit_reached', {
                conversationId,
                current: usageCheck.current,
                limit: usageCheck.limit,
            });
        }
        catch {
            // WebSocket might not be initialized in test
        }
        return;
    }
    // Step 5: Fetch agent
    const agentResult = await (0, database_1.query)('SELECT id, organization_id, name, system_prompt, llm_provider, llm_model, temperature, max_tokens, context_window_messages, message_buffer_seconds, variables, status, published_at FROM agents WHERE id = $1 AND organization_id = $2', [agentId, organizationId]);
    const agent = agentResult.rows[0];
    if (!agent || agent.status === 'draft') {
        console.error(`[msg-worker] Agent not found or not published: ${agentId}`);
        return;
    }
    // Step 6: Fetch enabled tools
    const toolsResult = await (0, database_1.query)('SELECT id, type, name, description, config, is_enabled FROM agent_tools WHERE agent_id = $1 AND is_enabled = true', [agentId]);
    const agentTools = toolsResult.rows;
    // Step 7: Build context
    const contextWindowMessages = Math.min(agent.context_window_messages, planLimits.contextWindowMessages);
    const maxTokens = Math.min(agent.max_tokens, planLimits.maxTokensPerResponse);
    // 7a. Build system prompt with variable instructions
    // Step 1: inject {{config.X}} from the agent's effective schema+values BEFORE
    // any other transformation. Captured variables and RAG context are then
    // appended to the substituted prompt — never to the raw one — so the LLM
    // never sees unresolved placeholders. See agent-config.service.ts.
    const variables = Array.isArray(agent.variables) ? agent.variables : [];
    const variableInstructions = (0, variable_capture_service_1.buildVariableCaptureInstructions)(variables);
    let fullSystemPrompt = await (0, agent_config_service_1.renderSystemPromptWithConfig)(agentId, agent.system_prompt);
    if (variableInstructions) {
        fullSystemPrompt += '\n\n' + variableInstructions;
    }
    // 7b. RAG context
    const hasRAG = await (0, rag_service_1.hasKnowledgeBase)(agentId);
    if (hasRAG) {
        const ragContext = await (0, rag_service_1.queryKnowledgeBase)(agentId, userMessageText);
        if (ragContext) {
            fullSystemPrompt += '\n\n' + ragContext;
        }
    }
    // 7c. Conversation history
    const historyResult = await (0, database_1.query)(`SELECT id, role, content, metadata, created_at
     FROM messages
     WHERE conversation_id = $1 AND role IN ('user', 'assistant', 'human', 'system')
     ORDER BY created_at DESC
     LIMIT $2`, [conversationId, contextWindowMessages * 2] // fetch more to account for system messages
    );
    const history = historyResult.rows
        .reverse()
        .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'human' ||
        (m.role === 'system' && m.metadata?.['type'] === 'intervention_summary'))
        .slice(-contextWindowMessages)
        .map((m) => ({
        role: m.role === 'human' ? 'assistant' : (m.role === 'system' ? 'assistant' : m.role),
        content: m.role === 'human'
            ? `[Human agent responded]: ${m.content}`
            : m.role === 'system'
                ? `[Intervention summary]: ${m.content}`
                : m.content,
    }));
    // Step 8: Build tools list for LLM
    const llmTools = [];
    // Internal: capture_variable (always included if there are variables)
    if (variables.length > 0) {
        llmTools.push(variable_capture_service_1.captureVariableToolDef);
    }
    // send_media native tool — available on WhatsApp and Web
    if (conv.channel === 'whatsapp' || conv.channel === 'web') {
        llmTools.push(send_media_service_1.sendMediaToolDef);
    }
    // Custom functions
    for (const tool of agentTools) {
        if (tool.type === 'custom_function' && tool.is_enabled) {
            const cfg = tool.config;
            // Frontend stores params as array: [{name, type, required}, ...]
            // LLM needs JSON Schema: {type:'object', properties:{...}, required:[...]}
            let parameters;
            const rawParams = cfg['parameters'] ?? cfg['params'];
            if (Array.isArray(rawParams)) {
                const properties = {};
                const required = [];
                for (const p of rawParams) {
                    if (!p.name)
                        continue;
                    properties[p.name] = {
                        type: p.type || 'string',
                        description: p.description || p.name,
                    };
                    if (p.required)
                        required.push(p.name);
                }
                parameters = { type: 'object', properties, required };
            }
            else if (rawParams && typeof rawParams === 'object' && rawParams['type'] === 'object') {
                parameters = rawParams;
            }
            else {
                parameters = { type: 'object', properties: {}, required: [] };
            }
            llmTools.push({
                name: tool.name.replace(/\s+/g, '_').toLowerCase(),
                description: tool.description ?? tool.name,
                parameters,
            });
        }
        if (tool.type === 'scheduling' && tool.is_enabled) {
            const calendarIds = (0, calendar_service_1.resolveCalendarIds)(tool.config);
            const hasMultipleCalendars = calendarIds.length > 1;
            llmTools.push({
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
            }, {
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
            });
        }
        if (tool.type === 'email_notification' && tool.is_enabled) {
            const cfg = tool.config;
            llmTools.push((0, send_email_notification_service_1.buildEmailNotificationToolDef)(tool.name, tool.description ?? tool.name, cfg));
        }
    }
    // MCP tools — load definitions (with Redis cache) and add to llmTools
    const mcpToolMap = {};
    for (const tool of agentTools) {
        if (tool.type !== 'mcp' || !tool.is_enabled)
            continue;
        const cfg = tool.config;
        const serverUrl = cfg.server_url ?? cfg.serverUrl ?? '';
        const serverName = cfg.name ?? cfg.serverName ?? 'mcp';
        const selectedTools = cfg.selected_tools ?? [];
        const mcpTransport = (cfg.transport === 'streamable-http' ? 'streamable-http' : 'sse');
        if (!serverUrl || selectedTools.length === 0)
            continue;
        // Build effective headers in 3 layers (left → right wins):
        //   1. profile auto-injected headers (master keys, fixed webhook URL,
        //      resolved on every call from platform_settings — never persisted)
        //   2. user-configured headers (encrypted in agent_tools.config.headers,
        //      can override profile in advanced mode)
        //   3. system auto-headers (X-Agent-ID, X-Session-ID, X-Webhook-Secret —
        //      identity & HMAC, always win)
        // See docs/INTEGRATION.md §3 + MCP-INT-2 design.
        let profileAutoHeaders = {};
        if (cfg.providerId) {
            try {
                const profile = await mcpProviders.findProfileById(cfg.providerId);
                if (profile && profile.is_active) {
                    profileAutoHeaders = await mcpProviders.resolveAutoHeaders(profile);
                }
            }
            catch (err) {
                console.error(`[msg-worker] Failed to resolve provider ${cfg.providerId} for tool ${tool.id}:`, err.message);
            }
        }
        const userHeaders = (0, mcp_headers_service_1.decryptHeaders)(cfg.headers);
        const autoHeaders = {
            'X-Agent-ID': agentId,
            'X-Session-ID': conversationId,
        };
        if (cfg.webhookSecret_encrypted) {
            try {
                autoHeaders['X-Webhook-Secret'] = (0, encryption_1.decrypt)(cfg.webhookSecret_encrypted);
            }
            catch (err) {
                console.error(`[msg-worker] Failed to decrypt webhookSecret for tool ${tool.id}:`, err.message);
            }
        }
        const allHeaders = { ...profileAutoHeaders, ...userHeaders, ...autoHeaders };
        const cacheKey = `mcp:tools:${tool.id}`;
        try {
            // Try Redis cache first (only the tool definition list — headers never cached)
            let toolDefs = null;
            const cached = await redis_1.redis.get(cacheKey).catch(() => null);
            if (cached) {
                try {
                    toolDefs = JSON.parse(cached);
                }
                catch {
                    toolDefs = null;
                }
            }
            if (!toolDefs) {
                // Fetch from MCP server (with auth headers if configured)
                const fetched = await (0, mcp_client_service_1.connectAndListTools)(serverUrl, mcpTransport, allHeaders);
                toolDefs = fetched;
                // Cache for 1 hour
                await redis_1.redis.setex(cacheKey, MCP_TOOLS_CACHE_TTL, JSON.stringify(toolDefs)).catch(() => { });
            }
            const sanitizedServerName = (0, mcp_client_service_1.sanitizeName)(serverName);
            for (const toolDef of toolDefs) {
                // Only include selected tools
                if (!selectedTools.includes(toolDef.name))
                    continue;
                const prefixedName = `mcp_${sanitizedServerName}_${(0, mcp_client_service_1.sanitizeName)(toolDef.name)}`;
                llmTools.push({
                    name: prefixedName,
                    description: `[MCP:${serverName}] ${toolDef.description}`,
                    parameters: toolDef.inputSchema,
                });
                mcpToolMap[prefixedName] = {
                    serverUrl,
                    originalToolName: toolDef.name,
                    transport: mcpTransport,
                    extraHeaders: allHeaders,
                };
            }
        }
        catch (err) {
            // Graceful degradation: log but continue without MCP tools
            console.error(`[msg-worker] Failed to load MCP tools for tool ${tool.id}:`, err.message);
        }
    }
    // Add scheduling instructions if a scheduling tool is enabled
    if (agentTools.some((t) => t.type === 'scheduling')) {
        const todayDate = new Date().toISOString().split('T')[0];
        const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const currentYear = new Date().getFullYear();
        const schedulingTool = agentTools.find((t) => t.type === 'scheduling');
        const calendarIds = schedulingTool ? (0, calendar_service_1.resolveCalendarIds)(schedulingTool.config) : [];
        if (calendarIds.length > 1) {
            const calResult = await (0, database_1.query)('SELECT id, name FROM calendars WHERE id = ANY($1::uuid[])', [calendarIds]);
            const calList = calResult.rows.map((c) => `- "${c.name}" → calendar_id: ${c.id}`).join('\n');
            fullSystemPrompt += `\n\nToday's date is ${todayDate} (${todayDay}). Always use the current year (${currentYear}) when interpreting user-mentioned dates and always output dates in YYYY-MM-DD format.\n\nYou have access to a scheduling system with multiple calendars:\n${calList}\n\nIMPORTANT: Use your system prompt instructions and the conversation context to determine which calendar to use. Do NOT ask the user which calendar or doctor — infer it from the conversation logic defined in your prompt. When calling check_availability or book_appointment, you MUST include the correct calendar_id based on your reasoning.\n\nScheduling flow:\n1. Determine the correct calendar based on conversation context and your prompt rules\n2. Call check_availability with the date AND the calendar_id\n3. Present the available slots to the user\n4. When the user confirms a slot, call book_appointment with date, time, name, and calendar_id`;
        }
        else {
            fullSystemPrompt += `\n\nToday's date is ${todayDate} (${todayDay}). Always use the current year (${currentYear}) when interpreting user-mentioned dates and always output dates in YYYY-MM-DD format.\n\nYou have access to a scheduling system. When the user wants to book an appointment:\n1. First call check_availability with the requested date (YYYY-MM-DD, year ${currentYear}) to see available time slots\n2. Present the available slots to the user\n3. When the user confirms a slot, call book_appointment with the date, time, and the user's name`;
        }
    }
    // Resolve BYO API key for this agent's provider (Enterprise only)
    let resolvedByoKey;
    if (plan === 'enterprise') {
        const { decrypt: decryptKey } = await Promise.resolve().then(() => __importStar(require('../config/encryption')));
        const provider = agent.llm_provider;
        if (provider === 'openai' && org?.byo_openai_key_encrypted) {
            try {
                resolvedByoKey = decryptKey(org.byo_openai_key_encrypted);
            }
            catch { /* invalid key */ }
        }
        else if (provider === 'anthropic' && org?.byo_anthropic_key_encrypted) {
            try {
                resolvedByoKey = decryptKey(org.byo_anthropic_key_encrypted);
            }
            catch { /* invalid key */ }
        }
    }
    // Step 9: LLM call with tool loop — build vision-aware user content
    const hasImages = imageItems.length > 0;
    const modelSupportsVision = (0, llm_service_1.supportsVision)(agent.llm_provider, agent.llm_model);
    let userContent;
    if (hasImages && modelSupportsVision) {
        const parts = [];
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
    }
    else if (hasImages && !modelSupportsVision) {
        const imageNote = imageItems.length === 1
            ? '[The user sent an image, but the current AI model does not support image analysis. Please let them know.]'
            : `[The user sent ${imageItems.length} images, but the current AI model does not support image analysis. Please let them know.]`;
        const combinedText = textParts.join('\n');
        userContent = combinedText ? `${combinedText}\n\n${imageNote}` : imageNote;
    }
    else {
        userContent = userMessageText;
    }
    const messages = [...history, { role: 'user', content: userContent }];
    let finalResponse = '';
    let totalTokensUsed = 0;
    const toolsCalledLog = [];
    let iterationCount = 0;
    try {
        let currentMessages = [...messages];
        while (iterationCount < MAX_TOOL_ITERATIONS) {
            iterationCount++;
            const response = await (0, llm_service_1.chat)({
                provider: agent.llm_provider,
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
                // Final text response — strip artifacts AND recover any leaked capture_variable calls.
                const { cleaned, extractedCaptures } = (0, text_1.stripAndExtractToolCallArtifacts)(response.content);
                if (extractedCaptures.length > 0) {
                    console.warn(`[msg-worker] Recovered ${extractedCaptures.length} leaked capture_variable call(s) from LLM text. Conversation ${conversationId}.`);
                    const syntheticCalls = (0, variable_capture_service_1.extractedCapturesToToolCalls)(extractedCaptures);
                    const syntheticResults = [];
                    for (const tc of syntheticCalls) {
                        const result = await executeTool(tc, agentTools, variables, conversationId, organizationId, agentId, mcpToolMap);
                        toolsCalledLog.push(`${tc.name}(${JSON.stringify(tc.arguments)})[recovered]`);
                        syntheticResults.push({ toolCallId: tc.id, content: result });
                    }
                    // Side effects ran; results not fed back to LLM since this is the final response.
                    void syntheticResults;
                }
                finalResponse = cleaned;
                break;
            }
            // Process tool calls
            const toolResults = [];
            for (const toolCall of response.toolCalls) {
                const result = await executeTool(toolCall, agentTools, variables, conversationId, organizationId, agentId, mcpToolMap);
                toolsCalledLog.push(`${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
                toolResults.push({ toolCallId: toolCall.id, content: result });
            }
            // Append the assistant's tool call message with structured tool call data
            currentMessages.push({
                role: 'assistant',
                content: response.content || '',
                toolCalls: response.toolCalls,
            });
            // Add tool results as a single structured message
            currentMessages.push({
                role: 'user',
                content: '',
                toolResults: toolResults.map((r) => ({
                    toolCallId: r.toolCallId,
                    content: r.content,
                })),
            });
            // If LLM also returned text alongside tool calls, keep it (cleaned).
            // Recover any capture_variable artifacts that leaked into the text.
            if (response.content.trim()) {
                const { cleaned, extractedCaptures } = (0, text_1.stripAndExtractToolCallArtifacts)(response.content);
                if (extractedCaptures.length > 0) {
                    console.warn(`[msg-worker] Recovered ${extractedCaptures.length} leaked capture_variable call(s) in mixed response. Conversation ${conversationId}.`);
                    const syntheticCalls = (0, variable_capture_service_1.extractedCapturesToToolCalls)(extractedCaptures);
                    for (const tc of syntheticCalls) {
                        const result = await executeTool(tc, agentTools, variables, conversationId, organizationId, agentId, mcpToolMap);
                        toolsCalledLog.push(`${tc.name}(${JSON.stringify(tc.arguments)})[recovered]`);
                        void result;
                    }
                }
                finalResponse = cleaned;
            }
        }
    }
    catch (err) {
        // Retry once
        try {
            const retryResponse = await (0, llm_service_1.chat)({
                provider: agent.llm_provider,
                model: agent.llm_model,
                system: fullSystemPrompt,
                messages,
                temperature: parseFloat(agent.temperature),
                maxTokens,
                byoApiKey: resolvedByoKey,
            });
            finalResponse = (0, text_1.stripAndExtractToolCallArtifacts)(retryResponse.content).cleaned;
            totalTokensUsed = retryResponse.usage.totalTokens;
        }
        catch (retryErr) {
            console.error('[msg-worker] LLM failed after retry:', retryErr);
            // Save error message
            const errorMessage = 'I encountered an error processing your message. Please try again.';
            const errorMeta = { error: true, errorMessage: retryErr.message };
            const errorSaved = await saveMessages(conversationId, userMessageText, errorMessage, errorMeta);
            await updateConversation(conversationId, 2);
            notifyClients(organizationId, conversationId, userMessageText, errorMessage, errorSaved, errorMeta);
            return;
        }
    }
    // Guard against minimal/empty responses (e.g. "...", ".", empty)
    const isMinimalResponse = (text) => {
        const stripped = text.replace(/[\s\p{P}]/gu, '');
        return stripped.length < 5;
    };
    if (isMinimalResponse(finalResponse)) {
        console.warn(`[msg-worker] Minimal LLM response detected: "${finalResponse}" — retrying`);
        try {
            const retryResponse = await (0, llm_service_1.chat)({
                provider: agent.llm_provider,
                model: agent.llm_model,
                system: fullSystemPrompt,
                messages,
                temperature: parseFloat(agent.temperature),
                maxTokens,
                byoApiKey: resolvedByoKey,
            });
            if (!isMinimalResponse(retryResponse.content)) {
                finalResponse = (0, text_1.stripAndExtractToolCallArtifacts)(retryResponse.content).cleaned;
                totalTokensUsed += retryResponse.usage.totalTokens;
            }
            else {
                console.warn(`[msg-worker] Retry also returned minimal response: "${retryResponse.content}"`);
                finalResponse = agent.llm_provider === 'anthropic'
                    ? 'Disculpa, no pude procesar tu mensaje. ¿Podrías repetirlo?'
                    : 'Sorry, I could not process your message. Could you please repeat it?';
            }
        }
        catch (retryErr) {
            console.error('[msg-worker] Retry for minimal response failed:', retryErr);
            finalResponse = 'Sorry, I could not process your message. Could you please repeat it?';
        }
    }
    // Step 10: Save messages
    const msgMetadata = {
        tokensUsed: totalTokensUsed,
        toolsCalled: toolsCalledLog,
        model: agent.llm_model,
        latencyMs: 0,
    };
    const userMsgMeta = {};
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
    const savedMessages = await saveMessages(conversationId, userMessageText, finalResponse, msgMetadata, Object.keys(userMsgMeta).length > 0 ? userMsgMeta : undefined);
    // Step 11: Update conversation stats
    await updateConversation(conversationId, bufferedItems.length + 1);
    // Step 12: Increment usage counter (skip for Enterprise BYO key users)
    if (!hasByoKey) {
        await (0, usage_service_1.incrementMessages)(organizationId);
    }
    // Step 13: Emit WebSocket events
    notifyClients(organizationId, conversationId, userMessageText, finalResponse, savedMessages, msgMetadata);
    // Step 14b: Trigger AI scoring after enough messages (threshold: 6)
    const updatedMessageCount = (conv.message_count ?? 0) + bufferedItems.length + 1;
    if (updatedMessageCount >= 6) {
        try {
            const scoreCheck = await (0, database_1.query)('SELECT ai_score FROM conversations WHERE id = $1', [conversationId]);
            if (scoreCheck.rows[0]?.ai_score === null) {
                const { scoringQueue } = await Promise.resolve().then(() => __importStar(require('../config/queues')));
                await scoringQueue.add('score-conversation', { conversationId, organizationId, trigger: 'message_threshold' }, { delay: 5000, jobId: `score-${conversationId}` });
            }
        }
        catch (err) {
            console.warn('[msg-worker] Could not enqueue scoring job:', err.message);
        }
    }
    // Step 14: Send via channel
    if (conv.channel === 'whatsapp') {
        try {
            const agentWaResult = await (0, database_1.query)('SELECT whatsapp_config FROM agents WHERE id = $1', [agentId]);
            const waConfig = agentWaResult.rows[0]?.whatsapp_config;
            if (waConfig?.connected && waConfig?.phone_number_id) {
                const contactResult = await (0, database_1.query)('SELECT phone FROM contacts WHERE id = $1', [conv.contact_id]);
                const phone = contactResult.rows[0]?.phone;
                if (phone) {
                    const accessToken = await (0, whatsapp_service_1.resolveAccessToken)(waConfig);
                    await (0, whatsapp_service_1.sendTextMessage)(String(waConfig.phone_number_id), accessToken, phone, finalResponse);
                    console.log(`[msg-worker] WhatsApp message sent to ${phone.slice(0, 4)}*** conv: ${conversationId}`);
                }
                else {
                    console.warn(`[msg-worker] No phone for contact — conv: ${conversationId}`);
                }
            }
            else {
                console.warn(`[msg-worker] WhatsApp not configured for agent ${agentId}`);
            }
        }
        catch (err) {
            console.error(`[msg-worker] WhatsApp send error for conv ${conversationId}:`, err.message);
        }
    }
    else if (conv.channel === 'web') {
        // Web widget notification via WebSocket (room per session)
        try {
            (0, websocket_1.getIO)().to(`conv:${conversationId}`).emit('message:new', {
                conversationId,
                role: 'assistant',
                content: finalResponse,
            });
        }
        catch {
            // WebSocket might not be initialized
        }
    }
}
async function executeTool(toolCall, agentTools, variables, conversationId, organizationId, agentId, mcpToolMap = {}) {
    const { name, arguments: args } = toolCall;
    // MCP tools (prefixed with mcp_)
    if (name.startsWith('mcp_') && mcpToolMap[name]) {
        const { serverUrl, originalToolName, transport, extraHeaders } = mcpToolMap[name];
        const result = await (0, mcp_client_service_1.executeMCPTool)(serverUrl, originalToolName, args, transport, extraHeaders);
        return result.content;
    }
    // Internal tool: capture_variable
    if (name === 'capture_variable') {
        const varName = String(args['variable_name'] ?? '');
        const varValue = String(args['variable_value'] ?? '');
        try {
            const io = (0, websocket_1.getIO)();
            const result = await (0, variable_capture_service_1.handleCaptureVariable)(conversationId, varName, varValue, variables, io);
            return result.message;
        }
        catch {
            const result = await (0, variable_capture_service_1.handleCaptureVariable)(conversationId, varName, varValue, variables);
            return result.message;
        }
    }
    // Internal tool: send_media
    if (name === 'send_media') {
        // Single query to get all context needed
        const ctxRes = await (0, database_1.query)(`SELECT
         c.channel,
         c.agent_id,
         co.phone AS contact_phone,
         a.whatsapp_config AS waba_config
       FROM conversations c
       JOIN agents a ON a.id = c.agent_id
       LEFT JOIN contacts co ON co.id = c.contact_id
       WHERE c.id = $1`, [conversationId]);
        const ctx = ctxRes.rows[0];
        if (!ctx)
            return 'Error: conversation not found';
        const mediaContext = {
            conversationId,
            agentId: ctx.agent_id,
            organizationId,
            channel: ctx.channel,
        };
        if (ctx.channel === 'whatsapp' &&
            ctx.waba_config?.connected &&
            ctx.waba_config?.phone_number_id &&
            ctx.contact_phone) {
            mediaContext.accessToken = await (0, whatsapp_service_1.resolveAccessToken)(ctx.waba_config);
            mediaContext.phoneNumberId = String(ctx.waba_config.phone_number_id);
            mediaContext.contactPhone = ctx.contact_phone;
        }
        const result = await (0, send_media_service_1.handleSendMedia)(args, mediaContext);
        return result.message;
    }
    // Scheduling tool — check available slots
    if (name === 'check_availability') {
        const date = String(args['date'] ?? '');
        if (!date)
            return 'Please provide a date in YYYY-MM-DD format.';
        // Multi-calendar: prefer calendar_id from LLM args, fallback to first in config
        let calendarId = String(args['calendar_id'] ?? '');
        if (!calendarId) {
            const schedulingTool = agentTools.find((t) => t.type === 'scheduling');
            const calIds = schedulingTool ? (0, calendar_service_1.resolveCalendarIds)(schedulingTool.config) : [];
            calendarId = calIds[0] ?? '';
        }
        if (!calendarId) {
            return 'No calendar configured for this agent.';
        }
        try {
            const slots = await (0, calendar_service_1.getAvailableSlots)(calendarId, date);
            if (!slots.length) {
                return `No available slots found for ${date}. Please try a different date.`;
            }
            const slotList = slots.map((s) => s.start).join(', ');
            return `Available slots for ${date}: ${slotList}. Which time works best for you?`;
        }
        catch {
            return `Could not check availability for ${date}. Please try again.`;
        }
    }
    // Scheduling tool — book appointment
    if (name === 'book_appointment') {
        const date = String(args['date'] ?? '');
        const time = String(args['time'] ?? '');
        const personName = String(args['name'] ?? 'Guest');
        if (!date || !time)
            return 'Please provide both date and time for the appointment.';
        // Multi-calendar: prefer calendar_id from LLM args, fallback to first in config
        let calendarId = String(args['calendar_id'] ?? '');
        if (!calendarId) {
            const schedulingTool = agentTools.find((t) => t.type === 'scheduling');
            const calIds = schedulingTool ? (0, calendar_service_1.resolveCalendarIds)(schedulingTool.config) : [];
            calendarId = calIds[0] ?? '';
        }
        if (!calendarId) {
            return 'No calendar configured for this agent.';
        }
        // Get slot duration and timezone from calendar
        let slotDuration = 30;
        let calendarTimezone = 'UTC';
        try {
            const { query: dbQuery } = await Promise.resolve().then(() => __importStar(require('../config/database')));
            const calResult = await dbQuery('SELECT slot_duration, timezone FROM calendars WHERE id = $1', [calendarId]);
            if (calResult.rows[0]) {
                slotDuration = calResult.rows[0].slot_duration;
                calendarTimezone = calResult.rows[0].timezone || 'UTC';
            }
        }
        catch {
            // use defaults
        }
        // Find or look up contact for this conversation
        let contactId = null;
        try {
            const { query: dbQuery } = await Promise.resolve().then(() => __importStar(require('../config/database')));
            const convResult = await dbQuery('SELECT contact_id FROM conversations WHERE id = $1', [conversationId]);
            contactId = convResult.rows[0]?.contact_id ?? null;
        }
        catch {
            // ignore
        }
        // Convert local calendar time → UTC for storage
        const startUTC = (0, calendar_service_1.localTimeToUTC)(date, time, calendarTimezone);
        const startTime = startUTC.toISOString();
        const endTime = new Date(startUTC.getTime() + slotDuration * 60000).toISOString();
        try {
            await (0, appointment_service_1.createAppointment)(organizationId, {
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
                const summaryMessages = await (0, database_1.query)(`SELECT role, content FROM messages
           WHERE conversation_id = $1 AND role IN ('user', 'assistant', 'human')
           ORDER BY created_at DESC LIMIT 20`, [conversationId]);
                if (summaryMessages.rows.length > 0) {
                    const transcript = summaryMessages.rows
                        .reverse()
                        .map((m) => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
                        .join('\n');
                    const { chat: llmChat } = await Promise.resolve().then(() => __importStar(require('../services/llm.service')));
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
            }
            catch (summaryErr) {
                console.error('[worker] Failed to generate meeting summary:', summaryErr);
                // Non-fatal — continue without summary
            }
            // Send email notification to calendar owner
            try {
                const calNotifResult = await (0, database_1.query)('SELECT notification_email, name FROM calendars WHERE id = $1', [calendarId]);
                const notifEmail = calNotifResult.rows[0]?.notification_email;
                const calName = calNotifResult.rows[0]?.name || 'Calendar';
                if (notifEmail) {
                    const { sendEmail, emailTemplate, getFrontendUrl } = await Promise.resolve().then(() => __importStar(require('../config/email')));
                    await sendEmail({
                        to: notifEmail,
                        subject: `New Appointment: ${personName} — ${date} at ${time}`,
                        html: emailTemplate(`<h2 style="margin:0 0 16px">New Appointment Booked</h2>
               <p><strong>Calendar:</strong> ${calName}</p>
               <p><strong>Client:</strong> ${personName}</p>
               <p><strong>Date:</strong> ${date}</p>
               <p><strong>Time:</strong> ${time}</p>
               <p><strong>Phone:</strong> ${String(args['phone'] ?? 'Not provided')}</p>
               ${meetingSummary ? `<p style="margin-top:12px;padding:12px;background:#f0fdf4;border-radius:8px;border-left:3px solid #25D366;font-size:14px;color:#1A1A1A;line-height:1.5;"><strong>Meeting topic:</strong><br/>${meetingSummary}</p>` : ''}
               <p style="margin-top:16px"><a href="${getFrontendUrl()}/dashboard/calendar" style="background:#25D366;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">View Calendar</a></p>`),
                    });
                }
            }
            catch (emailErr) {
                console.error('[worker] Failed to send appointment notification email:', emailErr);
            }
            // Send confirmation email to the end user (if email was captured)
            try {
                const contactEmailResult = await (0, database_1.query)(`SELECT co.email, co.name FROM contacts co
           JOIN conversations cv ON cv.contact_id = co.id
           WHERE cv.id = $1`, [conversationId]);
                const contactEmail = contactEmailResult.rows[0]?.email;
                const contactName = contactEmailResult.rows[0]?.name || personName;
                if (contactEmail) {
                    const { sendEmail, emailTemplate } = await Promise.resolve().then(() => __importStar(require('../config/email')));
                    const calNameResult = await (0, database_1.query)('SELECT name FROM calendars WHERE id = $1', [calendarId]);
                    const calName = calNameResult.rows[0]?.name || 'Calendar';
                    const summaryText = meetingSummary || 'Your appointment has been scheduled successfully.';
                    // Generate Google Calendar link
                    const gcalStart = new Date(startTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
                    const gcalEnd = new Date(endTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
                    const gcalTitle = encodeURIComponent(`Appointment — ${contactName}`);
                    const gcalDetails = encodeURIComponent(summaryText);
                    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalStart}/${gcalEnd}&details=${gcalDetails}`;
                    await sendEmail({
                        to: contactEmail,
                        subject: `Your Appointment is Confirmed — ${date} at ${time}`,
                        html: emailTemplate(`<h2 style="margin:0 0 16px;color:#1A1A1A;">Your Appointment is Confirmed! ✓</h2>
               <p style="color:#6B7280;font-size:15px;line-height:1.6;">Hi ${contactName}, your appointment has been booked. Here are the details:</p>
               <div style="background:#FFFFFF;border:1px solid #E5E0DB;border-radius:8px;padding:20px;margin:20px 0;">
                 <table style="width:100%;border-collapse:collapse;">
                   <tr><td style="color:#6B7280;font-size:14px;padding:6px 0;width:80px;">Date</td><td style="color:#1A1A1A;font-weight:600;padding:6px 0;">${date}</td></tr>
                   <tr><td style="color:#6B7280;font-size:14px;padding:6px 0;">Time</td><td style="color:#1A1A1A;font-weight:600;padding:6px 0;">${time}</td></tr>
                   <tr><td style="color:#6B7280;font-size:14px;padding:6px 0;">Calendar</td><td style="color:#1A1A1A;padding:6px 0;">${calName}</td></tr>
                 </table>
               </div>
               <div style="text-align:center;margin:20px 0;">
                 <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#25D366;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                   &#128197; Add to Google Calendar
                 </a>
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
               <p style="color:#9CA3AF;font-size:12px;margin-top:20px;">If you need to reschedule, please contact us directly.</p>`),
                    });
                    console.log(`[worker] Confirmation email sent to end user: ${contactEmail}`);
                }
            }
            catch (userEmailErr) {
                console.error('[worker] Failed to send user confirmation email:', userEmailErr);
                // Non-fatal — booking is already confirmed
            }
            return `Appointment confirmed for ${date} at ${time}. We look forward to seeing you, ${personName}!`;
        }
        catch (err) {
            return `Could not book the appointment: ${err.message}. Please choose another slot.`;
        }
    }
    // Internal tool: email_notification (per-tool-instance config)
    const emailNotifTool = agentTools.find((t) => t.type === 'email_notification' &&
        t.name.replace(/\s+/g, '_').toLowerCase() === name);
    if (emailNotifTool) {
        const result = await (0, send_email_notification_service_1.handleSendEmailNotification)(args, {
            conversationId,
            agentId,
            organizationId,
            toolId: emailNotifTool.id,
            toolName: emailNotifTool.name,
            config: emailNotifTool.config,
        });
        return result.message;
    }
    // Custom function tools
    const toolDef = agentTools.find((t) => t.type === 'custom_function' && t.name.replace(/\s+/g, '_').toLowerCase() === name);
    if (toolDef) {
        try {
            const { schema, values } = await (0, agent_config_service_1.loadAgentConfigForDeepInject)(agentId);
            const resolvedConfig = (0, shared_1.injectConfigVariablesDeep)(toolDef.config, schema, values);
            console.log(`[msg-worker] Custom function "${name}" — config resolved (placeholders substituted)`);
            return await (0, custom_function_service_1.executeCustomFunction)(resolvedConfig, args);
        }
        catch (err) {
            console.error(`[msg-worker] Custom function "${name}" failed:`, err.message);
            return `Error executing ${name}: ${err.message}`;
        }
    }
    return `Tool ${name} is not available.`;
}
async function saveMessages(conversationId, userMessage, assistantMessage, metadata, userMetadata) {
    const userResult = await (0, database_1.query)(`INSERT INTO messages (conversation_id, role, content, metadata, created_at)
     VALUES ($1, 'user', $2, $3, NOW())
     RETURNING id, created_at`, [conversationId, userMessage, JSON.stringify(userMetadata ?? {})]);
    const assistantResult = await (0, database_1.query)(`INSERT INTO messages (conversation_id, role, content, metadata, created_at)
     VALUES ($1, 'assistant', $2, $3, NOW())
     RETURNING id, created_at`, [conversationId, assistantMessage, JSON.stringify(metadata)]);
    return {
        userMsgId: userResult.rows[0].id,
        assistantMsgId: assistantResult.rows[0].id,
        userCreatedAt: userResult.rows[0].created_at,
        assistantCreatedAt: assistantResult.rows[0].created_at,
    };
}
async function updateConversation(conversationId, messageDelta) {
    await (0, database_1.query)(`UPDATE conversations
     SET last_message_at = NOW(),
         message_count = message_count + $1,
         updated_at = NOW()
     WHERE id = $2`, [messageDelta, conversationId]);
}
function notifyClients(organizationId, conversationId, userMessage, assistantMessage, savedMessages, metadata) {
    try {
        const io = (0, websocket_1.getIO)();
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
    }
    catch {
        // WebSocket might not be initialized
    }
}
function startMessageWorker() {
    const worker = new bullmq_1.Worker('message-processing', processMessage, {
        connection: (0, queues_1.createBullConnection)(),
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
//# sourceMappingURL=message.worker.js.map