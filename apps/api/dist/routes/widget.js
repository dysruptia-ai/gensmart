"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const errorHandler_1 = require("../middleware/errorHandler");
const message_buffer_service_1 = require("../services/message-buffer.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const shared_1 = require("@gensmart/shared");
const agent_config_service_1 = require("../services/agent-config.service");
const router = (0, express_1.Router)();
// Widget routes are public (no auth) and allow cross-origin access for embeds
const widgetCors = (0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});
router.use(widgetCors);
// Larger body limit for image/audio uploads (base64 can be ~13.3MB for 10MB audio)
router.use(express_2.default.json({ limit: '15mb' }));
// ── Rate limiting helpers ─────────────────────────────────────────────────────
async function checkSessionRateLimit(ip) {
    const key = `rl:widget:session:${ip}`;
    const count = await redis_1.redis.incr(key);
    if (count === 1)
        await redis_1.redis.expire(key, 3600); // 1 hour window
    return count <= 10; // max 10 sessions per IP per hour
}
async function checkMessageRateLimit(sessionId) {
    const key = `rl:widget:msg:${sessionId}`;
    const count = await redis_1.redis.incr(key);
    if (count === 1)
        await redis_1.redis.expire(key, 86400); // 24 hour window
    return count <= 100; // max 100 messages per session per day
}
function getClientIp(req) {
    return (req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'unknown');
}
// ── GET /api/widget/:agentId/config ──────────────────────────────────────────
router.get('/:agentId/config', async (req, res, next) => {
    try {
        const agentId = req.params['agentId'];
        // Try Redis cache first
        const cacheKey = `widget:config:${agentId}`;
        const cached = await redis_1.redis.get(cacheKey);
        if (cached) {
            res.json(JSON.parse(cached));
            return;
        }
        // Fetch from DB
        const result = await (0, database_1.query)(`SELECT a.id, a.name, a.avatar_url, a.avatar_initials, a.status, a.channels, a.web_config,
                o.plan
         FROM agents a
         JOIN organizations o ON o.id = a.organization_id
         WHERE a.id = $1`, [agentId]);
        const agent = result.rows[0];
        if (!agent) {
            throw new errorHandler_1.AppError(404, 'Agent not found', 'NOT_FOUND');
        }
        if (agent.status !== 'active') {
            throw new errorHandler_1.AppError(404, 'Agent is not published', 'AGENT_NOT_PUBLISHED');
        }
        if (!(agent.channels ?? []).includes('web')) {
            throw new errorHandler_1.AppError(403, 'Web widget is not enabled for this agent', 'CHANNEL_DISABLED');
        }
        const webCfg = agent.web_config ?? {};
        const rawWelcomeMessage = webCfg['welcome_message'] ?? 'Hello! How can I help you?';
        const { schema, values } = await (0, agent_config_service_1.loadAgentConfigForDeepInject)(agentId);
        const resolvedWelcomeMessage = (0, shared_1.injectConfigVariables)(rawWelcomeMessage, schema, values);
        const config = {
            agentId: agent.id,
            name: agent.name,
            avatar_url: agent.avatar_url,
            avatar_initials: agent.avatar_initials ?? (agent.name.charAt(0).toUpperCase()),
            primary_color: webCfg['primary_color'] ?? '#25D366',
            welcome_message: resolvedWelcomeMessage,
            bubble_text: webCfg['bubble_text'] ?? 'Chat with us',
            position: webCfg['position'] ?? 'bottom-right',
            show_branding: agent.plan === 'free',
        };
        // Cache for 5 minutes
        await redis_1.redis.set(cacheKey, JSON.stringify(config), 'EX', 300);
        res.json(config);
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/widget/:agentId/session ─────────────────────────────────────────
router.post('/:agentId/session', async (req, res, next) => {
    try {
        const agentId = req.params['agentId'];
        const ip = getClientIp(req);
        // Rate limit: max 10 sessions per IP per hour
        const allowed = await checkSessionRateLimit(ip);
        if (!allowed) {
            throw new errorHandler_1.AppError(429, 'Too many sessions created. Please try again later.', 'RATE_LIMIT');
        }
        // Fetch agent
        const agentResult = await (0, database_1.query)(`SELECT id, organization_id, status, channels, web_config, message_buffer_seconds
         FROM agents WHERE id = $1`, [agentId]);
        const agent = agentResult.rows[0];
        if (!agent || agent.status !== 'active') {
            throw new errorHandler_1.AppError(404, 'Agent not found or not published', 'NOT_FOUND');
        }
        if (!(agent.channels ?? []).includes('web')) {
            throw new errorHandler_1.AppError(403, 'Web widget is not enabled for this agent', 'CHANNEL_DISABLED');
        }
        const { fingerprint, referrer, userAgent } = req.body;
        // Create anonymous contact (include agent_id so contacts are properly attributed)
        const contactResult = await (0, database_1.query)(`INSERT INTO contacts (organization_id, agent_id, source_channel, custom_variables, created_at, updated_at)
         VALUES ($1, $2, 'web', $3::jsonb, NOW(), NOW())
         RETURNING id`, [
            agent.organization_id,
            agent.id,
            JSON.stringify({ fingerprint: fingerprint ?? null, referrer: referrer ?? null }),
        ]);
        const contactId = contactResult.rows[0].id;
        // Create conversation
        const convResult = await (0, database_1.query)(`INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status,
                                    channel_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, 'web', 'active', $4::jsonb, NOW(), NOW())
         RETURNING id`, [
            agent.organization_id,
            agent.id,
            contactId,
            JSON.stringify({
                ip: ip.slice(0, 15),
                userAgent: (userAgent ?? '').slice(0, 200),
                referrer: (referrer ?? '').slice(0, 500),
            }),
        ]);
        const sessionId = convResult.rows[0].id;
        const webCfg = agent.web_config ?? {};
        const welcomeMessage = webCfg['welcome_message'] ?? 'Hello! How can I help you?';
        res.json({ sessionId, welcomeMessage });
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/widget/:agentId/message ─────────────────────────────────────────
router.post('/:agentId/message', async (req, res, next) => {
    try {
        const agentId = String(req.params['agentId'] ?? '');
        const { sessionId, message, image, imageMimeType, audio, audioMimeType } = req.body;
        let resolvedSessionId = sessionId;
        const hasText = !!message?.trim();
        const hasImage = !!image;
        const hasAudio = !!audio;
        if (!hasText && !hasImage && !hasAudio) {
            throw new errorHandler_1.AppError(400, 'message, image, or audio is required', 'VALIDATION_ERROR');
        }
        // Validate image if present
        if (hasImage) {
            const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!imageMimeType || !validMimeTypes.includes(imageMimeType)) {
                throw new errorHandler_1.AppError(400, 'Invalid image type. Supported: JPEG, PNG, WebP, GIF', 'VALIDATION_ERROR');
            }
            const estimatedBytes = (image.length * 3) / 4;
            const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
            if (estimatedBytes > MAX_IMAGE_SIZE) {
                throw new errorHandler_1.AppError(400, 'Image too large. Maximum size is 5MB.', 'VALIDATION_ERROR');
            }
        }
        // Validate audio if present
        if (hasAudio) {
            const validAudioTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'];
            const baseAudioMime = (audioMimeType ?? '').split(';')[0].trim();
            if (!audioMimeType || !validAudioTypes.includes(baseAudioMime)) {
                throw new errorHandler_1.AppError(400, 'Invalid audio type. Supported: WebM, MP4, OGG, MP3, WAV', 'VALIDATION_ERROR');
            }
            // Validate size: 10MB max for widget
            const estimatedBytes = (audio.length * 3) / 4;
            const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
            if (estimatedBytes > MAX_AUDIO_SIZE) {
                throw new errorHandler_1.AppError(400, 'Audio too large. Maximum size is 10MB.', 'VALIDATION_ERROR');
            }
        }
        // Sanitize message (basic XSS prevention)
        const sanitizedMessage = hasText ? message.trim().slice(0, 4000) : '';
        // If no sessionId provided, create session on the fly (first message scenario)
        if (!resolvedSessionId) {
            const ip = getClientIp(req);
            const ipAllowed = await checkSessionRateLimit(ip);
            if (!ipAllowed) {
                throw new errorHandler_1.AppError(429, 'Too many sessions created. Please try again later.', 'RATE_LIMIT');
            }
            const agentCheck = await (0, database_1.query)(`SELECT id, organization_id, status, channels, web_config FROM agents WHERE id = $1`, [agentId]);
            const ag = agentCheck.rows[0];
            if (!ag || ag.status !== 'active' || !(ag.channels ?? []).includes('web')) {
                throw new errorHandler_1.AppError(404, 'Agent not found or not published', 'NOT_FOUND');
            }
            const contactRes = await (0, database_1.query)(`INSERT INTO contacts (organization_id, agent_id, source_channel, custom_variables, created_at, updated_at)
           VALUES ($1, $2, 'web', '{}'::jsonb, NOW(), NOW())
           RETURNING id`, [ag.organization_id, ag.id]);
            const newContactId = contactRes.rows[0].id;
            const convRes = await (0, database_1.query)(`INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status,
                                      channel_metadata, created_at, updated_at)
           VALUES ($1, $2, $3, 'web', 'active', '{}'::jsonb, NOW(), NOW())
           RETURNING id`, [ag.organization_id, ag.id, newContactId]);
            resolvedSessionId = convRes.rows[0].id;
        }
        // Rate limit per session
        const allowed = await checkMessageRateLimit(resolvedSessionId);
        if (!allowed) {
            throw new errorHandler_1.AppError(429, 'Message limit reached for this session', 'RATE_LIMIT');
        }
        // Validate session (conversation) belongs to this agent
        const convResult = await (0, database_1.query)(`SELECT id, agent_id, organization_id, status, contact_id
         FROM conversations
         WHERE id = $1 AND agent_id = $2 AND channel = 'web'`, [resolvedSessionId, agentId]);
        const conv = convResult.rows[0];
        if (!conv) {
            throw new errorHandler_1.AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
        }
        if (conv.status === 'closed') {
            throw new errorHandler_1.AppError(400, 'This conversation has ended', 'SESSION_CLOSED');
        }
        // Get agent's message buffer setting + org plan for multimodal gating
        const agentResult = await (0, database_1.query)('SELECT message_buffer_seconds, organization_id FROM agents WHERE id = $1', [agentId]);
        const bufferSeconds = agentResult.rows[0]?.message_buffer_seconds ?? 5;
        const orgPlanResult = await (0, database_1.query)('SELECT plan FROM organizations WHERE id = $1', [agentResult.rows[0]?.organization_id ?? conv.organization_id]);
        const widgetPlan = (orgPlanResult.rows[0]?.plan ?? 'free');
        const widgetPlanLimits = shared_1.PLAN_LIMITS[widgetPlan] ?? shared_1.PLAN_LIMITS.free;
        // Push to message buffer — image, voice transcription, or text (with plan gating)
        if (hasImage && !widgetPlanLimits.imageVision) {
            // Image vision not available on this plan — send text fallback
            const fallbackText = sanitizedMessage
                ? `${sanitizedMessage}\n\n[The user also sent an image, but image analysis is not available on your current plan.]`
                : '[The user sent an image, but image analysis is not available on your current plan. Please let them know they can upgrade to Pro for image analysis.]';
            await (0, message_buffer_service_1.pushToBuffer)(resolvedSessionId, agentId, conv.organization_id, fallbackText, bufferSeconds);
        }
        else if (hasAudio && !widgetPlanLimits.voiceMessages) {
            // Voice messages not available on this plan — send text fallback
            await (0, message_buffer_service_1.pushToBuffer)(resolvedSessionId, agentId, conv.organization_id, '[The user sent a voice message, but voice messages are not available on your current plan. Please let them know they can type their message instead.]', bufferSeconds);
        }
        else if (hasImage) {
            const imageItem = {
                type: 'image',
                content: sanitizedMessage,
                mimeType: imageMimeType,
                data: image,
            };
            await (0, message_buffer_service_1.pushToBuffer)(resolvedSessionId, agentId, conv.organization_id, imageItem, bufferSeconds);
        }
        else if (hasAudio) {
            // Transcribe audio with Whisper, then push as text
            try {
                const audioBuffer = Buffer.from(audio, 'base64');
                const transcription = await (0, whatsapp_service_1.transcribeAudio)(audioBuffer, audioMimeType ?? 'audio/webm');
                if (transcription.trim()) {
                    const voiceItem = {
                        type: 'text',
                        content: transcription.trim(),
                        mimeType: 'audio/voice-transcription',
                    };
                    await (0, message_buffer_service_1.pushToBuffer)(resolvedSessionId, agentId, conv.organization_id, voiceItem, bufferSeconds);
                }
                else {
                    await (0, message_buffer_service_1.pushToBuffer)(resolvedSessionId, agentId, conv.organization_id, '[Voice message — could not transcribe]', bufferSeconds);
                }
            }
            catch (err) {
                console.error('[widget] Audio transcription failed:', err.message);
                await (0, message_buffer_service_1.pushToBuffer)(resolvedSessionId, agentId, conv.organization_id, '[Voice message — transcription failed]', bufferSeconds);
            }
        }
        else {
            await (0, message_buffer_service_1.pushToBuffer)(resolvedSessionId, agentId, conv.organization_id, sanitizedMessage, bufferSeconds);
        }
        res.json({ messageId: null, status: 'queued', conversationStatus: conv.status, sessionId: resolvedSessionId });
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/widget/:agentId/messages ─────────────────────────────────────────
// Long-poll endpoint: returns messages after a given timestamp
// Waits up to 30s if no messages available
router.get('/:agentId/messages', async (req, res, next) => {
    try {
        const agentId = req.params['agentId'];
        const sessionId = req.query['sessionId'];
        const afterParam = req.query['after'];
        if (!sessionId) {
            throw new errorHandler_1.AppError(400, 'sessionId is required', 'VALIDATION_ERROR');
        }
        // Validate session — return empty messages if session was deleted (not 404)
        const convResult = await (0, database_1.query)('SELECT id, agent_id FROM conversations WHERE id = $1 AND agent_id = $2 AND channel = $3', [sessionId, agentId, 'web']);
        if (!convResult.rows[0]) {
            res.json({ messages: [] });
            return;
        }
        const after = afterParam ? new Date(afterParam) : new Date(0);
        const POLL_INTERVAL_MS = 1500;
        const MAX_WAIT_MS = 28000; // 28s — give buffer before server timeout
        const startTime = Date.now();
        const fetchMessages = async () => {
            const result = await (0, database_1.query)(`SELECT id, role, content, created_at, metadata
           FROM messages
           WHERE conversation_id = $1
             AND role IN ('assistant', 'human')
             AND created_at > $2
           ORDER BY created_at ASC
           LIMIT 20`, [sessionId, after.toISOString()]);
            return result.rows;
        };
        // Long poll loop
        while (true) {
            const messages = await fetchMessages();
            if (messages.length > 0) {
                res.json({ messages });
                return;
            }
            const elapsed = Date.now() - startTime;
            if (elapsed >= MAX_WAIT_MS) {
                res.json({ messages: [] });
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=widget.js.map