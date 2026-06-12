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
exports.sendMediaToolDef = exports.MEDIA_RATE_LIMIT = void 0;
exports.handleSendMedia = handleSendMedia;
const media_validator_service_1 = require("./media-validator.service");
const whatsapp_service_1 = require("./whatsapp.service");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const env_1 = require("../config/env");
// Rate limiting constants
exports.MEDIA_RATE_LIMIT = {
    // Per-conversation: prevent LLM loops within a single chat
    perConversation: {
        maxSends: 5,
        windowSeconds: 600, // 10 minutes
    },
    // Per-agent (global): prevent cross-conversation abuse
    perAgent: {
        maxSends: 20,
        windowSeconds: 3600, // 1 hour
    },
};
/** Tool definition — what the LLM sees */
exports.sendMediaToolDef = {
    name: 'send_media',
    description: [
        'Send a media file (image, video, or document) to the user during the conversation.',
        'Use this when the user asks to see a product, document, or visual content that you have URLs for.',
        'The media URL must be publicly accessible HTTPS. URLs are typically provided in your system prompt.',
        'Always provide a short, conversational caption describing what the user is about to see.',
        'After calling this tool, continue the conversation naturally — do NOT repeat that you sent the image.',
    ].join(' '),
    parameters: {
        type: 'object',
        properties: {
            type: {
                type: 'string',
                enum: ['image', 'video', 'document'],
                description: 'Type of media to send',
            },
            url: {
                type: 'string',
                description: 'Public HTTPS URL of the media file',
            },
            caption: {
                type: 'string',
                description: 'Optional short caption to accompany the media (max 1024 characters)',
            },
        },
        required: ['type', 'url'],
    },
};
async function handleSendMedia(args, context) {
    const type = args.type;
    const url = args.url;
    const caption = args.caption;
    // 1. Validate args
    if (!type || !['image', 'video', 'document'].includes(type)) {
        return { success: false, message: 'Error: Invalid media type. Must be one of: image, video, document.' };
    }
    if (!url || typeof url !== 'string') {
        return { success: false, message: 'Error: Media URL is required.' };
    }
    if (caption && caption.length > 1024) {
        return { success: false, message: 'Error: Caption too long (max 1024 characters).' };
    }
    // 2. Rate limit — per conversation
    const convKey = `media:rate:conv:${context.conversationId}`;
    const convCount = await redis_1.redis.incr(convKey);
    if (convCount === 1) {
        await redis_1.redis.expire(convKey, exports.MEDIA_RATE_LIMIT.perConversation.windowSeconds);
    }
    if (convCount > exports.MEDIA_RATE_LIMIT.perConversation.maxSends) {
        await logMediaSend(context, type, url, caption, 'rejected_rate_limit', undefined, undefined, `Per-conversation rate limit exceeded (${exports.MEDIA_RATE_LIMIT.perConversation.maxSends} per ${exports.MEDIA_RATE_LIMIT.perConversation.windowSeconds}s)`);
        return {
            success: false,
            message: `Rate limit reached: maximum ${exports.MEDIA_RATE_LIMIT.perConversation.maxSends} media files per conversation in ${Math.round(exports.MEDIA_RATE_LIMIT.perConversation.windowSeconds / 60)} minutes. Continue the conversation with text only.`,
        };
    }
    // 3. Rate limit — per agent
    const agentKey = `media:rate:agent:${context.agentId}`;
    const agentCount = await redis_1.redis.incr(agentKey);
    if (agentCount === 1) {
        await redis_1.redis.expire(agentKey, exports.MEDIA_RATE_LIMIT.perAgent.windowSeconds);
    }
    if (agentCount > exports.MEDIA_RATE_LIMIT.perAgent.maxSends) {
        await logMediaSend(context, type, url, caption, 'rejected_rate_limit', undefined, undefined, `Per-agent rate limit exceeded (${exports.MEDIA_RATE_LIMIT.perAgent.maxSends} per ${exports.MEDIA_RATE_LIMIT.perAgent.windowSeconds}s)`);
        return {
            success: false,
            message: `Agent media rate limit reached. Try again later or continue with text only.`,
        };
    }
    // 4. Validate URL (with Redis cache)
    const validation = await (0, media_validator_service_1.validateMediaUrl)(url, type);
    if (!validation.valid) {
        await logMediaSend(context, type, url, caption, 'rejected_validation', undefined, undefined, validation.error ?? validation.errorCode ?? 'Validation failed');
        return {
            success: false,
            message: `Could not send media: ${validation.error ?? 'URL validation failed'}. Please continue the conversation without the media.`,
        };
    }
    // 5. Send via channel
    try {
        if (context.channel === 'whatsapp') {
            if (!context.phoneNumberId || !context.accessToken || !context.contactPhone) {
                throw new Error('WhatsApp context missing (phoneNumberId, accessToken, or contactPhone)');
            }
            if (type === 'image') {
                // Route through our proxy so Meta sees image/jpeg or image/png even
                // when the upstream CDN serves the file as application/octet-stream.
                const proxiedUrl = `${env_1.env.API_URL}/api/media/proxy?url=${encodeURIComponent(url)}`;
                await (0, whatsapp_service_1.sendImageMessage)(context.phoneNumberId, context.accessToken, context.contactPhone, proxiedUrl, caption);
            }
            else if (type === 'document') {
                await (0, whatsapp_service_1.sendDocumentMessage)(context.phoneNumberId, context.accessToken, context.contactPhone, url, undefined, caption);
            }
            else if (type === 'video') {
                await (0, whatsapp_service_1.sendVideoMessage)(context.phoneNumberId, context.accessToken, context.contactPhone, url, caption);
            }
        }
        else if (context.channel !== 'web') {
            throw new Error(`Unsupported channel: ${context.channel}`);
        }
        // For web channel: no external API call needed; persisting the message below
        // and emitting via WebSocket is sufficient for the widget to render it.
        // 6. Persist as an assistant message with media metadata
        const msgResult = await (0, database_1.query)(`INSERT INTO messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'assistant', $2, $3, NOW())
       RETURNING id, created_at`, [
            context.conversationId,
            caption ?? '',
            JSON.stringify({
                media: { type, url, caption: caption ?? null },
                mimeType: validation.mimeType,
                sizeBytes: validation.sizeBytes,
            }),
        ]);
        // 7. Update conversation last_message_at
        await (0, database_1.query)(`UPDATE conversations
       SET last_message_at = NOW(), message_count = message_count + 1, updated_at = NOW()
       WHERE id = $1`, [context.conversationId]);
        // 8. Emit WebSocket event for real-time dashboard update
        try {
            const { getIO } = await Promise.resolve().then(() => __importStar(require('../config/websocket')));
            const io = getIO();
            const msgRow = msgResult.rows[0];
            const payload = {
                conversationId: context.conversationId,
                messages: [{
                        id: msgRow?.id,
                        role: 'assistant',
                        content: caption ?? '',
                        metadata: {
                            media: { type, url, caption: caption ?? null },
                            mimeType: validation.mimeType,
                        },
                        createdAt: msgRow?.created_at,
                    }],
            };
            io.to(`org:${context.organizationId}`).emit('message:new', payload);
            io.to(`conv:${context.conversationId}`).emit('message:new', payload);
        }
        catch {
            // WebSocket may not be initialized — non-fatal
        }
        // 9. Log the successful send
        await logMediaSend(context, type, url, caption, 'sent', validation.sizeBytes, validation.mimeType);
        return {
            success: true,
            message: `Media sent successfully (${type}). Continue the conversation naturally.`,
        };
    }
    catch (err) {
        const errorMsg = err.message ?? 'Unknown error';
        await logMediaSend(context, type, url, caption, 'failed', validation.sizeBytes, validation.mimeType, errorMsg);
        return {
            success: false,
            message: `Could not send media: ${errorMsg}. Continue the conversation without the media.`,
        };
    }
}
async function logMediaSend(context, type, url, caption, status, sizeBytes, mimeType, errorMessage) {
    try {
        await (0, database_1.query)(`INSERT INTO media_send_logs
       (conversation_id, agent_id, organization_id, channel, media_type, media_url, caption, status, error_message, size_bytes, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
            context.conversationId,
            context.agentId,
            context.organizationId,
            context.channel,
            type,
            url,
            caption ?? null,
            status,
            errorMessage ?? null,
            sizeBytes ?? null,
            mimeType ?? null,
        ]);
    }
    catch (err) {
        console.error('[send-media] Failed to log media send:', err);
        // Non-fatal — don't break the user-facing flow
    }
}
//# sourceMappingURL=send-media.service.js.map