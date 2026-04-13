import { ToolDefinition } from './llm.service';
import { validateMediaUrl, type MediaType } from './media-validator.service';
import {
  sendImageMessage,
  sendDocumentMessage,
  sendVideoMessage,
} from './whatsapp.service';
import { query } from '../config/database';
import { redis } from '../config/redis';

// Rate limiting constants
export const MEDIA_RATE_LIMIT = {
  // Per-conversation: prevent LLM loops within a single chat
  perConversation: {
    maxSends: 5,
    windowSeconds: 600,                     // 10 minutes
  },
  // Per-agent (global): prevent cross-conversation abuse
  perAgent: {
    maxSends: 20,
    windowSeconds: 3600,                    // 1 hour
  },
} as const;

/** Tool definition — what the LLM sees */
export const sendMediaToolDef: ToolDefinition = {
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

export interface SendMediaContext {
  conversationId: string;
  agentId: string;
  organizationId: string;
  channel: 'whatsapp' | 'web';
  // WhatsApp-specific
  phoneNumberId?: string;
  accessToken?: string;
  contactPhone?: string;
}

export interface SendMediaResult {
  success: boolean;
  message: string;   // What the LLM sees as tool result
}

export async function handleSendMedia(
  args: { type?: string; url?: string; caption?: string },
  context: SendMediaContext
): Promise<SendMediaResult> {
  const type = args.type as MediaType;
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
  const convCount = await redis.incr(convKey);
  if (convCount === 1) {
    await redis.expire(convKey, MEDIA_RATE_LIMIT.perConversation.windowSeconds);
  }
  if (convCount > MEDIA_RATE_LIMIT.perConversation.maxSends) {
    await logMediaSend(
      context, type, url, caption, 'rejected_rate_limit', undefined, undefined,
      `Per-conversation rate limit exceeded (${MEDIA_RATE_LIMIT.perConversation.maxSends} per ${MEDIA_RATE_LIMIT.perConversation.windowSeconds}s)`
    );
    return {
      success: false,
      message: `Rate limit reached: maximum ${MEDIA_RATE_LIMIT.perConversation.maxSends} media files per conversation in ${Math.round(MEDIA_RATE_LIMIT.perConversation.windowSeconds / 60)} minutes. Continue the conversation with text only.`,
    };
  }

  // 3. Rate limit — per agent
  const agentKey = `media:rate:agent:${context.agentId}`;
  const agentCount = await redis.incr(agentKey);
  if (agentCount === 1) {
    await redis.expire(agentKey, MEDIA_RATE_LIMIT.perAgent.windowSeconds);
  }
  if (agentCount > MEDIA_RATE_LIMIT.perAgent.maxSends) {
    await logMediaSend(
      context, type, url, caption, 'rejected_rate_limit', undefined, undefined,
      `Per-agent rate limit exceeded (${MEDIA_RATE_LIMIT.perAgent.maxSends} per ${MEDIA_RATE_LIMIT.perAgent.windowSeconds}s)`
    );
    return {
      success: false,
      message: `Agent media rate limit reached. Try again later or continue with text only.`,
    };
  }

  // 4. Validate URL (with Redis cache)
  const validation = await validateMediaUrl(url, type);
  if (!validation.valid) {
    await logMediaSend(
      context, type, url, caption, 'rejected_validation', undefined, undefined,
      validation.error ?? validation.errorCode ?? 'Validation failed'
    );
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
        await sendImageMessage(context.phoneNumberId, context.accessToken, context.contactPhone, url, caption);
      } else if (type === 'document') {
        await sendDocumentMessage(context.phoneNumberId, context.accessToken, context.contactPhone, url, undefined, caption);
      } else if (type === 'video') {
        await sendVideoMessage(context.phoneNumberId, context.accessToken, context.contactPhone, url, caption);
      }
    } else if (context.channel !== 'web') {
      throw new Error(`Unsupported channel: ${context.channel}`);
    }
    // For web channel: no external API call needed; persisting the message below
    // and emitting via WebSocket is sufficient for the widget to render it.

    // 6. Persist as an assistant message with media metadata
    const msgResult = await query<{ id: string; created_at: string }>(
      `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'assistant', $2, $3, NOW())
       RETURNING id, created_at`,
      [
        context.conversationId,
        caption ?? '',
        JSON.stringify({
          media: { type, url, caption: caption ?? null },
          mimeType: validation.mimeType,
          sizeBytes: validation.sizeBytes,
        }),
      ]
    );

    // 7. Update conversation last_message_at
    await query(
      `UPDATE conversations
       SET last_message_at = NOW(), message_count = message_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [context.conversationId]
    );

    // 8. Emit WebSocket event for real-time dashboard update
    try {
      const { getIO } = await import('../config/websocket');
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
    } catch {
      // WebSocket may not be initialized — non-fatal
    }

    // 9. Log the successful send
    await logMediaSend(context, type, url, caption, 'sent', validation.sizeBytes, validation.mimeType);

    return {
      success: true,
      message: `Media sent successfully (${type}). Continue the conversation naturally.`,
    };
  } catch (err) {
    const errorMsg = (err as Error).message ?? 'Unknown error';
    await logMediaSend(context, type, url, caption, 'failed', validation.sizeBytes, validation.mimeType, errorMsg);
    return {
      success: false,
      message: `Could not send media: ${errorMsg}. Continue the conversation without the media.`,
    };
  }
}

async function logMediaSend(
  context: SendMediaContext,
  type: string,
  url: string,
  caption: string | undefined,
  status: string,
  sizeBytes?: number,
  mimeType?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO media_send_logs
       (conversation_id, agent_id, organization_id, channel, media_type, media_url, caption, status, error_message, size_bytes, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
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
      ]
    );
  } catch (err) {
    console.error('[send-media] Failed to log media send:', err);
    // Non-fatal — don't break the user-facing flow
  }
}
