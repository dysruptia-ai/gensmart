import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import cors from 'cors';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { AppError } from '../middleware/errorHandler';
import { pushToBuffer } from '../services/message-buffer.service';
import type { BufferItem } from '../services/message-buffer.service';
import { transcribeAudio } from '../services/whatsapp.service';
import { PLAN_LIMITS } from '@gensmart/shared';

const router = Router();

// Widget routes are public (no auth) and allow cross-origin access for embeds
const widgetCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

router.use(widgetCors);

// Larger body limit for image/audio uploads (base64 can be ~13.3MB for 10MB audio)
router.use(express.json({ limit: '15mb' }));

// ── Rate limiting helpers ─────────────────────────────────────────────────────

async function checkSessionRateLimit(ip: string): Promise<boolean> {
  const key = `rl:widget:session:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600); // 1 hour window
  return count <= 10; // max 10 sessions per IP per hour
}

async function checkMessageRateLimit(sessionId: string): Promise<boolean> {
  const key = `rl:widget:msg:${sessionId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 86400); // 24 hour window
  return count <= 100; // max 100 messages per session per day
}

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// ── GET /api/widget/:agentId/config ──────────────────────────────────────────
router.get(
  '/:agentId/config',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = req.params['agentId'];

      // Try Redis cache first
      const cacheKey = `widget:config:${agentId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.json(JSON.parse(cached));
        return;
      }

      // Fetch from DB
      const result = await query<{
        id: string;
        name: string;
        avatar_url: string | null;
        avatar_initials: string | null;
        status: string;
        channels: string[];
        web_config: Record<string, unknown>;
        plan: string;
      }>(
        `SELECT a.id, a.name, a.avatar_url, a.avatar_initials, a.status, a.channels, a.web_config,
                o.plan
         FROM agents a
         JOIN organizations o ON o.id = a.organization_id
         WHERE a.id = $1`,
        [agentId]
      );

      const agent = result.rows[0];
      if (!agent) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      if (agent.status !== 'active') {
        throw new AppError(404, 'Agent is not published', 'AGENT_NOT_PUBLISHED');
      }

      if (!(agent.channels ?? []).includes('web')) {
        throw new AppError(403, 'Web widget is not enabled for this agent', 'CHANNEL_DISABLED');
      }

      const webCfg = agent.web_config ?? {};
      const config = {
        agentId: agent.id,
        name: agent.name,
        avatar_url: agent.avatar_url,
        avatar_initials: agent.avatar_initials ?? (agent.name.charAt(0).toUpperCase()),
        primary_color: (webCfg['primary_color'] as string) ?? '#25D366',
        welcome_message: (webCfg['welcome_message'] as string) ?? 'Hello! How can I help you?',
        bubble_text: (webCfg['bubble_text'] as string) ?? 'Chat with us',
        position: (webCfg['position'] as string) ?? 'bottom-right',
        show_branding: agent.plan === 'free',
      };

      // Cache for 5 minutes
      await redis.set(cacheKey, JSON.stringify(config), 'EX', 300);

      res.json(config);
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/widget/:agentId/session ─────────────────────────────────────────
router.post(
  '/:agentId/session',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = req.params['agentId'];
      const ip = getClientIp(req);

      // Rate limit: max 10 sessions per IP per hour
      const allowed = await checkSessionRateLimit(ip);
      if (!allowed) {
        throw new AppError(429, 'Too many sessions created. Please try again later.', 'RATE_LIMIT');
      }

      // Fetch agent
      const agentResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        channels: string[];
        web_config: Record<string, unknown>;
        message_buffer_seconds: number;
      }>(
        `SELECT id, organization_id, status, channels, web_config, message_buffer_seconds
         FROM agents WHERE id = $1`,
        [agentId]
      );

      const agent = agentResult.rows[0];
      if (!agent || agent.status !== 'active') {
        throw new AppError(404, 'Agent not found or not published', 'NOT_FOUND');
      }

      if (!(agent.channels ?? []).includes('web')) {
        throw new AppError(403, 'Web widget is not enabled for this agent', 'CHANNEL_DISABLED');
      }

      const { fingerprint, referrer, userAgent } = req.body as {
        fingerprint?: string;
        referrer?: string;
        userAgent?: string;
      };

      // Create anonymous contact (include agent_id so contacts are properly attributed)
      const contactResult = await query<{ id: string }>(
        `INSERT INTO contacts (organization_id, agent_id, source_channel, custom_variables, created_at, updated_at)
         VALUES ($1, $2, 'web', $3::jsonb, NOW(), NOW())
         RETURNING id`,
        [
          agent.organization_id,
          agent.id,
          JSON.stringify({ fingerprint: fingerprint ?? null, referrer: referrer ?? null }),
        ]
      );
      const contactId = contactResult.rows[0]!.id;

      // Create conversation
      const convResult = await query<{ id: string }>(
        `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status,
                                    channel_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, 'web', 'active', $4::jsonb, NOW(), NOW())
         RETURNING id`,
        [
          agent.organization_id,
          agent.id,
          contactId,
          JSON.stringify({
            ip: ip.slice(0, 15),
            userAgent: (userAgent ?? '').slice(0, 200),
            referrer: (referrer ?? '').slice(0, 500),
          }),
        ]
      );
      const sessionId = convResult.rows[0]!.id;

      const webCfg = agent.web_config ?? {};
      const welcomeMessage = (webCfg['welcome_message'] as string) ?? 'Hello! How can I help you?';

      res.json({ sessionId, welcomeMessage });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/widget/:agentId/message ─────────────────────────────────────────
router.post(
  '/:agentId/message',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['agentId'] ?? '');
      const { sessionId, message, image, imageMimeType, audio, audioMimeType } = req.body as {
        sessionId: string;
        message?: string;
        image?: string;        // base64-encoded image data (NO data: prefix)
        imageMimeType?: string; // 'image/jpeg', 'image/png', etc.
        audio?: string;        // base64-encoded audio data
        audioMimeType?: string; // 'audio/webm', 'audio/mp4', etc.
      };

      if (!sessionId) {
        throw new AppError(400, 'sessionId is required', 'VALIDATION_ERROR');
      }

      const hasText = !!message?.trim();
      const hasImage = !!image;
      const hasAudio = !!audio;

      if (!hasText && !hasImage && !hasAudio) {
        throw new AppError(400, 'message, image, or audio is required', 'VALIDATION_ERROR');
      }

      // Validate image if present
      if (hasImage) {
        const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!imageMimeType || !validMimeTypes.includes(imageMimeType)) {
          throw new AppError(400, 'Invalid image type. Supported: JPEG, PNG, WebP, GIF', 'VALIDATION_ERROR');
        }
        const estimatedBytes = (image.length * 3) / 4;
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
        if (estimatedBytes > MAX_IMAGE_SIZE) {
          throw new AppError(400, 'Image too large. Maximum size is 5MB.', 'VALIDATION_ERROR');
        }
      }

      // Validate audio if present
      if (hasAudio) {
        const validAudioTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'];
        const baseAudioMime = (audioMimeType ?? '').split(';')[0]!.trim();
        if (!audioMimeType || !validAudioTypes.includes(baseAudioMime)) {
          throw new AppError(400, 'Invalid audio type. Supported: WebM, MP4, OGG, MP3, WAV', 'VALIDATION_ERROR');
        }

        // Validate size: 10MB max for widget
        const estimatedBytes = (audio.length * 3) / 4;
        const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
        if (estimatedBytes > MAX_AUDIO_SIZE) {
          throw new AppError(400, 'Audio too large. Maximum size is 10MB.', 'VALIDATION_ERROR');
        }
      }

      // Sanitize message (basic XSS prevention)
      const sanitizedMessage = hasText ? message!.trim().slice(0, 4000) : '';

      // Rate limit per session
      const allowed = await checkMessageRateLimit(sessionId);
      if (!allowed) {
        throw new AppError(429, 'Message limit reached for this session', 'RATE_LIMIT');
      }

      // Validate session (conversation) belongs to this agent
      const convResult = await query<{
        id: string;
        agent_id: string;
        organization_id: string;
        status: string;
        contact_id: string;
      }>(
        `SELECT id, agent_id, organization_id, status, contact_id
         FROM conversations
         WHERE id = $1 AND agent_id = $2 AND channel = 'web'`,
        [sessionId, agentId]
      );

      const conv = convResult.rows[0];
      if (!conv) {
        throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
      }

      if (conv.status === 'closed') {
        throw new AppError(400, 'This conversation has ended', 'SESSION_CLOSED');
      }

      // Get agent's message buffer setting + org plan for multimodal gating
      const agentResult = await query<{ message_buffer_seconds: number; organization_id: string }>(
        'SELECT message_buffer_seconds, organization_id FROM agents WHERE id = $1',
        [agentId]
      );
      const bufferSeconds = agentResult.rows[0]?.message_buffer_seconds ?? 5;

      const orgPlanResult = await query<{ plan: string }>(
        'SELECT plan FROM organizations WHERE id = $1',
        [agentResult.rows[0]?.organization_id ?? conv.organization_id]
      );
      const widgetPlan = (orgPlanResult.rows[0]?.plan ?? 'free') as keyof typeof PLAN_LIMITS;
      const widgetPlanLimits = PLAN_LIMITS[widgetPlan] ?? PLAN_LIMITS.free;

      // Push to message buffer — image, voice transcription, or text (with plan gating)
      if (hasImage && !widgetPlanLimits.imageVision) {
        // Image vision not available on this plan — send text fallback
        const fallbackText = sanitizedMessage
          ? `${sanitizedMessage}\n\n[The user also sent an image, but image analysis is not available on your current plan.]`
          : '[The user sent an image, but image analysis is not available on your current plan. Please let them know they can upgrade to Pro for image analysis.]';
        await pushToBuffer(sessionId, agentId, conv.organization_id, fallbackText, bufferSeconds);
      } else if (hasAudio && !widgetPlanLimits.voiceMessages) {
        // Voice messages not available on this plan — send text fallback
        await pushToBuffer(sessionId, agentId, conv.organization_id, '[The user sent a voice message, but voice messages are not available on your current plan. Please let them know they can type their message instead.]', bufferSeconds);
      } else if (hasImage) {
        const imageItem: BufferItem = {
          type: 'image',
          content: sanitizedMessage,
          mimeType: imageMimeType!,
          data: image!,
        };
        await pushToBuffer(sessionId, agentId, conv.organization_id, imageItem, bufferSeconds);
      } else if (hasAudio) {
        // Transcribe audio with Whisper, then push as text
        try {
          const audioBuffer = Buffer.from(audio!, 'base64');
          const transcription = await transcribeAudio(audioBuffer, audioMimeType ?? 'audio/webm');

          if (transcription.trim()) {
            const voiceItem: BufferItem = {
              type: 'text',
              content: transcription.trim(),
              mimeType: 'audio/voice-transcription',
            };
            await pushToBuffer(sessionId, agentId, conv.organization_id, voiceItem, bufferSeconds);
          } else {
            await pushToBuffer(sessionId, agentId, conv.organization_id, '[Voice message — could not transcribe]', bufferSeconds);
          }
        } catch (err) {
          console.error('[widget] Audio transcription failed:', (err as Error).message);
          await pushToBuffer(sessionId, agentId, conv.organization_id, '[Voice message — transcription failed]', bufferSeconds);
        }
      } else {
        await pushToBuffer(sessionId, agentId, conv.organization_id, sanitizedMessage, bufferSeconds);
      }

      res.json({ messageId: null, status: 'queued', conversationStatus: conv.status });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/widget/:agentId/messages ─────────────────────────────────────────
// Long-poll endpoint: returns messages after a given timestamp
// Waits up to 30s if no messages available
router.get(
  '/:agentId/messages',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = req.params['agentId'];
      const sessionId = req.query['sessionId'] as string;
      const afterParam = req.query['after'] as string;

      if (!sessionId) {
        throw new AppError(400, 'sessionId is required', 'VALIDATION_ERROR');
      }

      // Validate session
      const convResult = await query<{ id: string; agent_id: string }>(
        'SELECT id, agent_id FROM conversations WHERE id = $1 AND agent_id = $2 AND channel = $3',
        [sessionId, agentId, 'web']
      );

      if (!convResult.rows[0]) {
        throw new AppError(404, 'Session not found', 'SESSION_NOT_FOUND');
      }

      const after = afterParam ? new Date(afterParam) : new Date(0);
      const POLL_INTERVAL_MS = 1500;
      const MAX_WAIT_MS = 28000; // 28s — give buffer before server timeout

      const startTime = Date.now();

      const fetchMessages = async () => {
        const result = await query<{
          id: string;
          role: string;
          content: string;
          created_at: string;
        }>(
          `SELECT id, role, content, created_at
           FROM messages
           WHERE conversation_id = $1
             AND role IN ('assistant', 'human')
             AND created_at > $2
           ORDER BY created_at ASC
           LIMIT 20`,
          [sessionId, after.toISOString()]
        );
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
    } catch (err) {
      next(err);
    }
  }
);

export default router;
