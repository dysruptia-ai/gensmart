import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import { checkChannelAccess } from '../middleware/planLimits';
import { validateUUID } from '../middleware/validateUUID';
import { query } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { transcribeAudio } from '../services/whatsapp.service';
import {
  BOT_TOKEN_PATTERN,
  TelegramApiError,
  encryptBotToken,
  resolveBotToken,
  maskBotToken,
  validateBotToken,
  setTelegramWebhook,
  deleteTelegramWebhook,
  sendTelegramTyping,
  downloadTelegramImage,
  downloadTelegramAudio,
  parseIncomingUpdate,
} from '../services/telegram.service';
import type { TelegramIncomingMessage } from '../services/telegram.service';
import { pushToBuffer } from '../services/message-buffer.service';
import type { BufferItem } from '../services/message-buffer.service';
import { PLAN_LIMITS } from '@gensmart/shared';

const router = Router();

const BOT_UNIQUE_INDEX = 'uq_agents_telegram_bot_id';
const DISCONNECTED_CONFIG = JSON.stringify({
  bot_id: null,
  bot_username: null,
  bot_token_encrypted: null,
  webhook_secret_token: null,
  connected: false,
});

// Telegram only accepts A-Za-z0-9_- (1–256 chars) as secret_token; ours are 64 hex chars
const SECRET_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

function webhookUrl(): string {
  return `${env.API_URL}/api/telegram/webhook`;
}

// A concurrent request can win the race between the duplicate check and the UPDATE;
// the unique index then rejects the loser with 23505.
function isBotUniqueViolation(err: unknown): boolean {
  const pgErr = err as { code?: string; constraint?: string } | null;
  return pgErr?.code === '23505' && pgErr.constraint === BOT_UNIQUE_INDEX;
}

function botAlreadyConnectedError(): AppError {
  return new AppError(409, 'This Telegram bot is already connected to another agent', 'BOT_ALREADY_CONNECTED');
}

// ── Incoming message pipeline ─────────────────────────────────────────────────

interface TelegramAgentRow {
  id: string;
  organization_id: string;
  message_buffer_seconds: number;
  telegram_config: Record<string, unknown>;
  status: string;
}

async function processTelegramMessage(agent: TelegramAgentRow, msg: TelegramIncomingMessage): Promise<void> {
  const chatId = msg.chatId;
  let messageText = msg.text;
  const imageCaption = msg.text;
  if (!messageText) {
    messageText = msg.photoFileId ? '[Image]' : '[Voice message]';
  }

  const orgResult = await query<{ plan: string }>(
    'SELECT plan FROM organizations WHERE id = $1',
    [agent.organization_id]
  );
  const plan = (orgResult.rows[0]?.plan ?? 'free') as keyof typeof PLAN_LIMITS;
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  let botToken: string | null = null;
  try {
    botToken = resolveBotToken(agent.telegram_config);
  } catch (err) {
    console.error('[telegram] Cannot resolve bot token:', (err as Error).message);
  }

  // Image: download via getFile (gate by plan)
  let imageBufferItem: BufferItem | null = null;
  if (msg.photoFileId) {
    if (!planLimits.imageVision) {
      console.log(`[telegram] Org ${agent.organization_id} on ${plan} plan — image vision not available`);
      messageText = imageCaption
        ? `${imageCaption}\n\n[The user also sent an image, but image analysis is not available on your current plan. Let them know they can upgrade to Pro for image analysis.]`
        : '[The user sent an image, but image analysis is not available on your current plan. Please let them know they can upgrade to Pro for image analysis.]';
    } else if (botToken) {
      try {
        const media = await downloadTelegramImage(botToken, msg.photoFileId);
        imageBufferItem = { type: 'image', content: imageCaption, mimeType: media.mimeType, data: media.data };
        console.log(`[telegram] Downloaded image: ${media.mimeType}, ${Math.round(media.data.length * 0.75 / 1024)}KB`);
      } catch (err) {
        console.error('[telegram] Failed to download image:', (err as Error).message);
        // Continue without image — treat as text-only with caption
      }
    }
  }

  // Voice note: download the .ogg and transcribe (gate by plan)
  let audioTranscription: string | null = null;
  if (msg.voiceFileId) {
    if (!planLimits.voiceMessages) {
      console.log(`[telegram] Org ${agent.organization_id} on ${plan} plan — voice messages not available`);
      messageText = '[The user sent a voice message, but voice messages are not available on your current plan. Please let them know they can type their message instead.]';
    } else if (botToken) {
      try {
        const audio = await downloadTelegramAudio(botToken, msg.voiceFileId);
        console.log(`[telegram] Downloaded audio: ${audio.mimeType}, ${Math.round(audio.buffer.length / 1024)}KB`);
        const transcription = await transcribeAudio(audio.buffer, audio.mimeType);
        if (transcription.trim()) {
          audioTranscription = transcription.trim();
          messageText = audioTranscription;
        } else {
          console.warn('[telegram] Whisper returned empty transcription');
          messageText = '[Voice message — could not transcribe]';
        }
      } catch (err) {
        console.error('[telegram] Failed to download/transcribe audio:', (err as Error).message);
        messageText = '[Voice message — transcription failed]';
      }
    }
  }

  // Find or create contact by chat_id (upsert: concurrent first messages cannot create duplicates)
  const contactResult = await query<{ id: string }>(
    `INSERT INTO contacts (organization_id, agent_id, name, telegram_chat_id, source_channel, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'telegram', NOW(), NOW())
     ON CONFLICT (organization_id, telegram_chat_id) WHERE telegram_chat_id IS NOT NULL
     DO UPDATE SET agent_id = COALESCE(contacts.agent_id, EXCLUDED.agent_id),
                   name = COALESCE(contacts.name, EXCLUDED.name),
                   updated_at = NOW()
     RETURNING id`,
    [agent.organization_id, agent.id, msg.contactName, chatId]
  );
  const contactId = contactResult.rows[0]!.id;

  // Find or create active conversation
  const existingConv = await query<{ id: string; status: string }>(
    `SELECT id, status FROM conversations
     WHERE agent_id = $1 AND contact_id = $2 AND channel = 'telegram' AND status != 'closed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [agent.id, contactId]
  );

  let convId: string;
  let convStatus: string;
  if (existingConv.rows[0]) {
    convId = existingConv.rows[0].id;
    convStatus = existingConv.rows[0].status;
  } else {
    const newConv = await query<{ id: string; status: string }>(
      `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status, channel_metadata, created_at, updated_at)
       VALUES ($1, $2, $3, 'telegram', 'active', '{}'::jsonb, NOW(), NOW())
       RETURNING id, status`,
      [agent.organization_id, agent.id, contactId]
    );
    convId = newConv.rows[0]!.id;
    convStatus = newConv.rows[0]!.status;
  }

  // Typing indicator (fire and forget) — always, regardless of takeover status
  if (botToken) {
    void sendTelegramTyping(botToken, chatId);
  }

  // During human takeover — save message + notify dashboard, skip LLM
  if (convStatus === 'human_takeover') {
    console.log(`[telegram] Conversation ${convId} in human takeover — saving message, skipping LLM`);

    const userMsgMeta: Record<string, unknown> = {};
    if (imageBufferItem?.data) {
      userMsgMeta['hasImages'] = true;
      userMsgMeta['imageCount'] = 1;
      userMsgMeta['images'] = [{ mimeType: imageBufferItem.mimeType, hasCaption: !!imageBufferItem.content }];
    }
    if (audioTranscription) {
      userMsgMeta['isVoiceMessage'] = true;
    }

    const msgResult = await query<{ id: string; created_at: string }>(
      `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
       VALUES ($1, 'user', $2, $3, NOW())
       RETURNING id, created_at`,
      [convId, messageText, JSON.stringify(userMsgMeta)]
    );

    await query(
      `UPDATE conversations SET last_message_at = NOW(), message_count = message_count + 1, updated_at = NOW() WHERE id = $1`,
      [convId]
    );

    try {
      const { getIO } = await import('../config/websocket');
      const io = getIO();
      io.to(`org:${agent.organization_id}`).emit('message:new', {
        conversationId: convId,
        messages: [{
          id: msgResult.rows[0]!.id,
          role: 'user',
          content: messageText,
          metadata: userMsgMeta,
          createdAt: msgResult.rows[0]!.created_at,
        }],
      });
      io.to(`org:${agent.organization_id}`).emit('conversation:update', {
        conversationId: convId,
        lastMessage: messageText.slice(0, 100),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // WebSocket not initialized
    }
    return;
  }

  // Push to message buffer — image, voice transcription, or text
  if (imageBufferItem?.data) {
    await pushToBuffer(convId, agent.id, agent.organization_id, imageBufferItem, agent.message_buffer_seconds);
  } else if (audioTranscription) {
    const voiceItem: BufferItem = {
      type: 'text',
      content: audioTranscription,
      mimeType: 'audio/voice-transcription',
    };
    await pushToBuffer(convId, agent.id, agent.organization_id, voiceItem, agent.message_buffer_seconds);
  } else {
    await pushToBuffer(convId, agent.id, agent.organization_id, messageText, agent.message_buffer_seconds);
  }
}

// ── POST /api/telegram/webhook ────────────────────────────────────────────────
// Telegram does not sign payloads. The secret_token we registered with setWebhook comes back in
// X-Telegram-Bot-Api-Secret-Token and is the ONLY authentication: it also identifies the agent (the URL
// is shared by every bot). Nothing is processed without a match.
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (typeof secret !== 'string' || !SECRET_PATTERN.test(secret)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

  let agent: TelegramAgentRow | undefined;
  try {
    const result = await query<TelegramAgentRow>(
      `SELECT id, organization_id, message_buffer_seconds, telegram_config, status
       FROM agents
       WHERE (telegram_config->>'webhook_secret_token_hash') = $1
         AND (telegram_config->>'connected')::boolean = true
       LIMIT 1`,
      [secretHash]
    );
    agent = result.rows[0];
  } catch (err) {
    // Non-2xx makes Telegram retry later
    console.error('[telegram] Webhook agent lookup failed:', (err as Error).message);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  if (!agent) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Acknowledge immediately; Telegram retries slow or failing deliveries
  res.status(200).json({ ok: true });

  try {
    if (agent.status !== 'active') {
      console.log(`[telegram] Agent ${agent.id} is not active — ignoring update`);
      return;
    }
    const incoming = parseIncomingUpdate(req.body);
    if (!incoming) return;
    await processTelegramMessage(agent, incoming);
  } catch (err) {
    console.error('[telegram] Webhook processing error:', err);
  }
});

// ── POST /api/telegram/connect ────────────────────────────────────────────────
const connectSchema = z.object({
  agentId: z.string().uuid(),
  botToken: z.string().trim().regex(BOT_TOKEN_PATTERN, 'Invalid bot token format'),
});

router.post(
  '/connect',
  requireAuth,
  orgContext,
  checkChannelAccess('telegram'),
  validate(connectSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { agentId, botToken } = req.body as z.infer<typeof connectSchema>;

      // 1. Verify agent belongs to org
      const agentCheck = await query<{ id: string; telegram_config: Record<string, unknown> | null }>(
        'SELECT id, telegram_config FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      const agent = agentCheck.rows[0];
      if (!agent) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      // 2. Validate the token with Telegram (getMe)
      let bot;
      try {
        bot = await validateBotToken(botToken);
      } catch (err) {
        if (err instanceof TelegramApiError && (err.errorCode === 401 || err.errorCode === 404 || err.errorCode === 0)) {
          throw new AppError(400, 'Telegram rejected this bot token. Copy it again from @BotFather.', 'INVALID_BOT_TOKEN');
        }
        console.error('[telegram-connect] getMe failed:', (err as Error).message);
        throw new AppError(502, 'Could not reach Telegram. Please try again.', 'TELEGRAM_UNAVAILABLE');
      }

      // 3. One bot, one agent (a bot has a single webhook)
      const inUse = await query(
        `SELECT 1 FROM agents WHERE telegram_config->>'bot_id' = $1 AND id <> $2 LIMIT 1`,
        [bot.id, agentId]
      );
      if (inUse.rows.length > 0) {
        throw botAlreadyConnectedError();
      }

      // 4. Save first (the unique index settles any race), then register the webhook. Doing it the other
      //    way round would let a losing request overwrite the winner's webhook secret on Telegram.
      const webhookSecret = crypto.randomBytes(32).toString('hex');
      const webhookSecretHash = crypto.createHash('sha256').update(webhookSecret).digest('hex');
      const previousConfig = agent.telegram_config;
      try {
        await query(
          `UPDATE agents SET telegram_config = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [
            JSON.stringify({
              bot_id: bot.id,
              bot_username: bot.username,
              bot_token_encrypted: encryptBotToken(botToken),
              webhook_secret_token: null,
              webhook_secret_token_hash: webhookSecretHash,
              connected: true,
              connected_at: new Date().toISOString(),
            }),
            agentId,
          ]
        );
      } catch (saveErr) {
        if (isBotUniqueViolation(saveErr)) throw botAlreadyConnectedError();
        throw saveErr;
      }

      try {
        await setTelegramWebhook(botToken, webhookUrl(), webhookSecret);
      } catch (hookErr) {
        console.error('[telegram-connect] setWebhook failed:', (hookErr as Error).message);
        // Roll back so the agent is not left "connected" without a webhook
        await query(
          `UPDATE agents SET telegram_config = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [previousConfig ? JSON.stringify(previousConfig) : DISCONNECTED_CONFIG, agentId]
        );
        throw new AppError(502, 'Telegram did not accept the webhook. Please try again.', 'WEBHOOK_SET_FAILED');
      }

      // 5. The agent was connected to a different bot before: stop that bot's webhook (best effort)
      if (previousConfig?.['connected'] && previousConfig['bot_id'] !== bot.id && previousConfig['bot_token_encrypted']) {
        try {
          await deleteTelegramWebhook(resolveBotToken(previousConfig));
        } catch {
          // Old token may be revoked — the new config is already saved
        }
      }

      // 6. Ensure 'telegram' is in channels array
      await query(
        `UPDATE agents
         SET channels = (
           SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
           FROM jsonb_array_elements_text(COALESCE(channels, '[]'::jsonb) || '["telegram"]'::jsonb) elem
         )
         WHERE id = $1`,
        [agentId]
      );

      console.log(`[telegram-connect] Agent ${agentId} connected to bot ${bot.id}`);

      res.json({
        success: true,
        botUsername: bot.username,
        botId: bot.id,
        maskedToken: maskBotToken(botToken),
        webhookUrl: webhookUrl(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/telegram/disconnect ─────────────────────────────────────────────
const disconnectSchema = z.object({ agentId: z.string().uuid() });

router.post(
  '/disconnect',
  requireAuth,
  orgContext,
  validate(disconnectSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { agentId } = req.body as z.infer<typeof disconnectSchema>;
      const agentCheck = await query<{ id: string; telegram_config: Record<string, unknown> | null }>(
        'SELECT id, telegram_config FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      const agent = agentCheck.rows[0];
      if (!agent) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      // Stop Telegram from delivering this bot's updates to us (best effort)
      const cfg = agent.telegram_config ?? {};
      if (cfg['bot_token_encrypted']) {
        try {
          await deleteTelegramWebhook(resolveBotToken(cfg));
        } catch {
          // Token may be revoked or undecryptable — the local config is cleared regardless
        }
      }

      await query(
        `UPDATE agents SET telegram_config = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [DISCONNECTED_CONFIG, agentId]
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/telegram/status/:agentId ─────────────────────────────────────────
router.get(
  '/status/:agentId',
  requireAuth,
  orgContext,
  validateUUID('agentId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['agentId']);
      const result = await query<{ telegram_config: Record<string, unknown> | null; channels: string[] }>(
        'SELECT telegram_config, channels FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      const agent = result.rows[0];
      if (!agent) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      const cfg = agent.telegram_config ?? {};
      const connected = !!cfg['connected'];
      let maskedToken: string | null = null;
      if (connected) {
        try {
          maskedToken = maskBotToken(resolveBotToken(cfg));
        } catch {
          // Undecryptable token: still report the connection, just without the mask
        }
      }

      // The real token is never returned — only the masked tail
      res.json({
        connected,
        botId: cfg['bot_id'] ?? null,
        botUsername: cfg['bot_username'] ?? null,
        maskedToken,
        webhookUrl: webhookUrl(),
        channelEnabled: (agent.channels ?? []).includes('telegram'),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
