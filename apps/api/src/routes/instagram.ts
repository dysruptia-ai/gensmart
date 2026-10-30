import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { checkChannelAccess } from '../middleware/planLimits';
import { validateUUID } from '../middleware/validateUUID';
import { query } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { verifyWebhookSignature, transcribeAudio } from '../services/whatsapp.service';
import {
  encryptPageAccessToken,
  resolveAccessToken,
  sendSenderAction,
  downloadImageFromUrl,
  downloadAudioFromUrl,
  listInstagramAccounts,
  exchangeForLongLivedToken,
  subscribePageToApp,
  unsubscribePageFromApp,
  decryptPageAccessToken,
  InstagramMessagingDisabledError,
  META_BASE_URL,
} from '../services/instagram.service';
import type { InstagramAccount } from '../services/instagram.service';
import { createSignupSession, loadSignupSession, deleteSignupSession } from '../services/instagram-signup-session.service';
import { pushToBuffer } from '../services/message-buffer.service';
import type { BufferItem } from '../services/message-buffer.service';
import { PLAN_LIMITS } from '@gensmart/shared';

const router = Router();

const ACCOUNT_UNIQUE_INDEX = 'uq_agents_instagram_account_id';

// A concurrent request can win the race between the duplicate check and the UPDATE;
// the unique index then rejects the loser with 23505.
function isAccountUniqueViolation(err: unknown): boolean {
  const pgErr = err as { code?: string; constraint?: string } | null;
  return pgErr?.code === '23505' && pgErr.constraint === ACCOUNT_UNIQUE_INDEX;
}

function messagingDisabledError(): AppError {
  return new AppError(409, 'This Instagram account has not enabled third-party message access', 'MESSAGING_DISABLED');
}

function instagramAccountAlreadyConnectedError(): AppError {
  return new AppError(409, 'This Instagram account is already connected to another agent', 'ACCOUNT_ALREADY_CONNECTED');
}

// ── GET /api/instagram/webhook ────────────────────────────────────────────────
// Meta webhook verification challenge
router.get('/webhook', async (req: Request, res: Response): Promise<void> => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode !== 'subscribe' || !token || !challenge) {
    res.status(403).json({ error: 'Verification failed' });
    return;
  }

  try {
    // Same Meta app as WhatsApp and Instagram, so the platform-level verify token is shared.
    const { getSettingValue } = await import('../services/platform-settings.service');
    let platformVerifyToken = '';
    try {
      platformVerifyToken = await getSettingValue('whatsapp_verify_token');
    } catch {
      // Setting might not exist yet
    }
    const verifyToken = platformVerifyToken || env.WHATSAPP_VERIFY_TOKEN || env.META_VERIFY_TOKEN;

    if (verifyToken && token === verifyToken) {
      console.log('[instagram] Webhook verified via platform verify token');
      res.status(200).send(challenge);
    } else {
      console.log('[instagram] Webhook verification failed — token mismatch');
      res.status(403).json({ error: 'Verification failed' });
    }
  } catch (err) {
    console.error('[instagram] Webhook verification error:', err);
    res.status(403).json({ error: 'Verification failed' });
  }
});

interface InstagramAttachment {
  type?: string;
  payload?: { url?: string };
}

interface InstagramEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: InstagramAttachment[];
  };
}

interface InstagramWebhookBody {
  object?: string;
  entry?: Array<{ id?: string; messaging?: InstagramEvent[] }>;
}

async function processMessagingEvent(instagramId: string, event: InstagramEvent): Promise<void> {
  const message = event.message;
  // Skip delivery/read receipts, postbacks (no text flow yet) and echoes of the account's own messages
  if (!message || message.is_echo) return;

  // Instagram-scoped sender ID (IGSID); stored in contacts.instagram_psid
  const psid = event.sender?.id;
  if (!psid || psid === instagramId) return;

  const attachment = message.attachments?.[0];
  let messageText = message.text ?? '';
  let imageUrl: string | null = null;
  let audioUrl: string | null = null;

  if (attachment) {
    if (attachment.type === 'image' && attachment.payload?.url) {
      imageUrl = attachment.payload.url;
      messageText = messageText || '[Image]';
    } else if (attachment.type === 'audio' && attachment.payload?.url) {
      audioUrl = attachment.payload.url;
      messageText = '[Voice message]';
    } else if (!messageText) {
      console.log(`[instagram] Skipping unsupported attachment type: ${attachment.type ?? 'unknown'}`);
      return;
    }
  }
  if (!messageText) return;
  const imageCaption = message.text ?? '';

  // Find active agent by Instagram account ID (entry.id in Instagram webhooks is the IGID, not the Page ID)
  const agentResult = await query<{
    id: string;
    organization_id: string;
    message_buffer_seconds: number;
    instagram_config: Record<string, unknown>;
    status: string;
  }>(
    `SELECT id, organization_id, message_buffer_seconds, instagram_config, status
     FROM agents
     WHERE (instagram_config->>'instagram_id') = $1
       AND (instagram_config->>'connected')::boolean = true
       AND status = 'active'
     LIMIT 1`,
    [instagramId]
  );

  const agent = agentResult.rows[0];
  if (!agent) {
    console.log(`[instagram] No active agent for instagram_id: ${instagramId}`);
    return;
  }

  const orgResult = await query<{ plan: string }>(
    'SELECT plan FROM organizations WHERE id = $1',
    [agent.organization_id]
  );
  const plan = (orgResult.rows[0]?.plan ?? 'free') as keyof typeof PLAN_LIMITS;
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  let pageToken: string | null = null;
  try {
    pageToken = resolveAccessToken(agent.instagram_config);
  } catch (err) {
    console.error('[instagram] Cannot resolve Page token:', (err as Error).message);
  }

  // Image: download from the attachment URL (gate by plan)
  let imageBufferItem: BufferItem | null = null;
  if (imageUrl) {
    if (!planLimits.imageVision) {
      console.log(`[instagram] Org ${agent.organization_id} on ${plan} plan — image vision not available`);
      messageText = imageCaption
        ? `${imageCaption}\n\n[The user also sent an image, but image analysis is not available on your current plan. Let them know they can upgrade to Pro for image analysis.]`
        : '[The user sent an image, but image analysis is not available on your current plan. Please let them know they can upgrade to Pro for image analysis.]';
    } else {
      try {
        const media = await downloadImageFromUrl(imageUrl);
        imageBufferItem = { type: 'image', content: imageCaption, mimeType: media.mimeType, data: media.data };
        console.log(`[instagram] Downloaded image: ${media.mimeType}, ${Math.round(media.data.length * 0.75 / 1024)}KB`);
      } catch (err) {
        console.error('[instagram] Failed to download image:', (err as Error).message);
        // Continue without image — treat as text-only with caption
      }
    }
  }

  // Audio: download and transcribe (gate by plan)
  let audioTranscription: string | null = null;
  if (audioUrl) {
    if (!planLimits.voiceMessages) {
      console.log(`[instagram] Org ${agent.organization_id} on ${plan} plan — voice messages not available`);
      messageText = '[The user sent a voice message, but voice messages are not available on your current plan. Please let them know they can type their message instead.]';
    } else {
      try {
        const audio = await downloadAudioFromUrl(audioUrl);
        console.log(`[instagram] Downloaded audio: ${audio.mimeType}, ${Math.round(audio.buffer.length / 1024)}KB`);
        const transcription = await transcribeAudio(audio.buffer, audio.mimeType);
        if (transcription.trim()) {
          audioTranscription = transcription.trim();
          messageText = audioTranscription;
        } else {
          console.warn('[instagram] Whisper returned empty transcription');
          messageText = '[Voice message — could not transcribe]';
        }
      } catch (err) {
        console.error('[instagram] Failed to download/transcribe audio:', (err as Error).message);
        messageText = '[Voice message — transcription failed]';
      }
    }
  }

  // Find or create contact by PSID (upsert: concurrent first messages cannot create duplicates)
  const contactResult = await query<{ id: string }>(
    `INSERT INTO contacts (organization_id, agent_id, instagram_psid, source_channel, created_at, updated_at)
     VALUES ($1, $2, $3, 'instagram', NOW(), NOW())
     ON CONFLICT (organization_id, instagram_psid) WHERE instagram_psid IS NOT NULL
     DO UPDATE SET agent_id = COALESCE(contacts.agent_id, EXCLUDED.agent_id), updated_at = NOW()
     RETURNING id`,
    [agent.organization_id, agent.id, psid]
  );
  const contactId = contactResult.rows[0]!.id;

  // Find or create active conversation
  const existingConv = await query<{ id: string; status: string }>(
    `SELECT id, status FROM conversations
     WHERE agent_id = $1 AND contact_id = $2 AND channel = 'instagram' AND status != 'closed'
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
       VALUES ($1, $2, $3, 'instagram', 'active', '{}'::jsonb, NOW(), NOW())
       RETURNING id, status`,
      [agent.organization_id, agent.id, contactId]
    );
    convId = newConv.rows[0]!.id;
    convStatus = newConv.rows[0]!.status;
  }

  // Mark as seen + typing indicator (fire and forget) — always, regardless of takeover status
  if (pageToken) {
    void sendSenderAction(pageToken, instagramId, psid, 'mark_seen');
    void sendSenderAction(pageToken, instagramId, psid, 'typing_on');
  }

  // During human takeover — save message + notify dashboard, skip LLM
  if (convStatus === 'human_takeover') {
    console.log(`[instagram] Conversation ${convId} in human takeover — saving message, skipping LLM`);

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

// ── POST /api/instagram/webhook ───────────────────────────────────────────────
// Must respond 200 immediately — Meta requires fast acknowledgment
router.post(
  '/webhook',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    res.status(200).json({ status: 'ok' });

    try {
      // req.body is a Buffer (express.raw registered before express.json in index.ts)
      const rawBuffer: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const appSecret = env.WHATSAPP_APP_SECRET || env.META_APP_SECRET;
      if (appSecret) {
        const signature = req.headers['x-hub-signature-256'] as string;
        if (!signature || !verifyWebhookSignature(rawBuffer, signature, appSecret)) {
          console.warn('[instagram] Invalid webhook signature — ignoring');
          return;
        }
      } else if (process.env['NODE_ENV'] === 'production') {
        console.error('[instagram] No app secret configured in production — rejecting webhook');
        return;
      } else {
        console.warn('[instagram] No app secret configured — skipping signature validation');
      }

      let body: InstagramWebhookBody;
      try {
        body = JSON.parse(rawBuffer.toString()) as InstagramWebhookBody;
      } catch {
        console.warn('[instagram] Failed to parse webhook body');
        return;
      }

      if (body.object !== 'instagram') return;

      // Meta batches several entries / events per delivery
      for (const entry of body.entry ?? []) {
        const instagramId = entry.id;
        if (!instagramId) continue;
        for (const event of entry.messaging ?? []) {
          try {
            await processMessagingEvent(instagramId, event);
          } catch (err) {
            console.error('[instagram] Event processing error:', err);
          }
        }
      }
    } catch (err) {
      console.error('[instagram] Webhook processing error:', err);
    }
  }
);

// The web client now uses FB.login with response_type 'token' + fb_exchange_token (the fbToken branch),
// which involves no redirect_uri. The fbCode branch below is kept as an unused fallback.
// Why: the code from FB.login() (JS SDK popup) is tied to Facebook's internal relay URI (xd_arbiter), and all
// three redirect_uri variants failed with error_subcode 36008: (a) omitted, (b) 'https://www.gensmart.co/',
// (c) sent empty. Not needed in the WhatsApp exchange (Embedded Signup is exempt from the validation).
const INSTAGRAM_REDIRECT_URI = '';

// ── POST /api/instagram/embedded-signup-complete ─────────────────────────────
// Take the Facebook Login token, list the Instagram accounts linked to the user's Pages, subscribe the
// chosen account's Page and connect the agent
router.post(
  '/embedded-signup-complete',
  requireAuth,
  orgContext,
  checkChannelAccess('instagram'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fbAppId = env.FACEBOOK_APP_ID;
      const fbAppSecret = env.FACEBOOK_APP_SECRET;
      if (!fbAppId || !fbAppSecret) {
        throw new AppError(503, 'Facebook App credentials not configured on this server', 'NOT_CONFIGURED');
      }

      const { agentId, fbCode, fbToken, signupSessionId, selectedInstagramId } = req.body as {
        agentId: string;
        fbCode?: string;
        fbToken?: string;
        signupSessionId?: string;
        selectedInstagramId?: string;
      };

      // 2. Verify agent belongs to org
      const agentCheck = await query<{ id: string }>(
        'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      // 3. Resolve the user's Facebook access token — either a re-selection round trip
      //    (token already exchanged in a prior call) or the first call (exchange the code).
      let userToken: string;
      if (signupSessionId) {
        const sessionToken = await loadSignupSession(signupSessionId, { orgId: req.org!.id, agentId });
        if (!sessionToken) {
          throw new AppError(400, 'Connection session expired. Start again.', 'SIGNUP_SESSION_EXPIRED');
        }
        userToken = sessionToken;
      } else if (fbToken) {
        // Short-lived user token handed over by FB.login (response_type 'token'): no code to redeem and
        // no redirect_uri involved. Validity and app ownership are verified by debug_token below.
        userToken = await exchangeForLongLivedToken(fbToken, fbAppId, fbAppSecret);
      } else if (fbCode) {
        // Server-to-server only — never expose this call to the client. The code has a 30-second TTL.
        const tokenExchangeRes = await fetch(
          `${META_BASE_URL}/oauth/access_token?client_id=${encodeURIComponent(fbAppId)}&client_secret=${encodeURIComponent(fbAppSecret)}&code=${encodeURIComponent(fbCode)}&redirect_uri=${encodeURIComponent(INSTAGRAM_REDIRECT_URI)}`
        );
        if (!tokenExchangeRes.ok) {
          const exchangeErr = await tokenExchangeRes.json().catch(() => ({}));
          console.error('[instagram-signup] Code exchange failed:', JSON.stringify(exchangeErr));
          throw new AppError(401, 'Failed to exchange authorization code. The code may have expired (30s TTL) — please try connecting again.', 'CODE_EXCHANGE_FAILED');
        }
        const tokenExchangeData = await tokenExchangeRes.json() as { access_token?: string };
        if (!tokenExchangeData.access_token) {
          throw new AppError(401, 'Failed to obtain access token from Facebook', 'CODE_EXCHANGE_FAILED');
        }
        // Page tokens derived from a long-lived user token do not expire
        userToken = await exchangeForLongLivedToken(tokenExchangeData.access_token, fbAppId, fbAppSecret);
      } else {
        throw new AppError(400, 'Missing agentId and fbToken, fbCode or signupSessionId', 'VALIDATION_ERROR');
      }

      // 4. Validate the token was issued for this app (app access token = "<app_id>|<app_secret>")
      const debugRes = await fetch(
        `${META_BASE_URL}/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(`${fbAppId}|${fbAppSecret}`)}`
      );
      if (!debugRes.ok) {
        const debugErr = await debugRes.json().catch(() => ({}));
        console.error('[instagram-signup] debug_token failed:', JSON.stringify(debugErr));
        throw new AppError(500, 'Failed to validate Facebook token', 'DEBUG_TOKEN_FAILED');
      }
      const debugData = await debugRes.json() as { data?: { is_valid?: boolean; app_id?: string } };
      if (!debugData.data?.is_valid) {
        throw new AppError(401, 'Facebook token is invalid or expired', 'INVALID_FB_TOKEN');
      }
      if (debugData.data.app_id && debugData.data.app_id !== fbAppId) {
        throw new AppError(401, 'Facebook token was not issued for this app', 'INVALID_FB_TOKEN');
      }

      // 5. List the Instagram professional accounts linked to Pages the user administers
      //    (the Page token that sends/receives for each account comes with the listing)
      let accounts: InstagramAccount[];
      try {
        accounts = await listInstagramAccounts(userToken);
      } catch (listErr) {
        if (listErr instanceof InstagramMessagingDisabledError) throw messagingDisabledError();
        console.error('[instagram-signup]', (listErr as Error).message);
        throw new AppError(502, 'Could not list your Instagram accounts. Please try again.', 'ACCOUNT_LIST_FAILED');
      }
      if (accounts.length === 0) {
        throw new AppError(400, 'No Instagram professional accounts found. Make sure the account is Business or Creator, linked to a Facebook Page you administer, and that you granted access to it.', 'NO_INSTAGRAM_ACCOUNTS_FOUND');
      }

      // 6. Accounts already connected to other agents (any organization). Never reveal which agent or org.
      const inUseResult = await query<{ iid: string }>(
        `SELECT instagram_config->>'instagram_id' AS iid
         FROM agents
         WHERE instagram_config->>'instagram_id' = ANY($1::text[])
           AND id <> $2`,
        [accounts.map((a) => a.instagramId), agentId]
      );
      const inUse = new Set(inUseResult.rows.map((r) => r.iid));
      const available = accounts.filter((a) => !inUse.has(a.instagramId));

      let selected = selectedInstagramId ? accounts.find((a) => a.instagramId === selectedInstagramId) : undefined;
      if (selectedInstagramId && !selected) {
        throw new AppError(400, 'Selected Instagram account is not available for this login', 'INVALID_SELECTION');
      }
      if (selected && inUse.has(selected.instagramId)) {
        throw instagramAccountAlreadyConnectedError();
      }

      if (!selected) {
        if (available.length === 0) {
          throw new AppError(409, 'All Instagram accounts shared with this app are already connected to other agents', 'ACCOUNT_ALREADY_CONNECTED');
        }
        if (available.length > 1) {
          res.json({
            success: false,
            requiresSelection: 'account',
            options: available.map((a) => ({ id: a.instagramId, name: `@${a.username}` })),
            signupSessionId: signupSessionId || await createSignupSession(userToken, { orgId: req.org!.id, agentId }),
          });
          return;
        }
        selected = available[0]!;
      }

      // 7. Subscribe the linked Page to the app's webhook with the PAGE token (the Instagram account's
      //    messages are delivered through its linked Page subscription).
      let subscribed: boolean;
      try {
        subscribed = await subscribePageToApp(selected.pageId, selected.accessToken);
      } catch (subscribeErr) {
        if (subscribeErr instanceof InstagramMessagingDisabledError) throw messagingDisabledError();
        throw subscribeErr;
      }
      if (!subscribed) {
        throw new AppError(500, 'Failed to subscribe the Page to webhooks. Check the app permissions and try connecting again.', 'WEBHOOK_SUBSCRIBE_FAILED');
      }

      // 8. Save agent config
      try {
        await query(
          `UPDATE agents
           SET instagram_config = $1::jsonb,
               updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify({
              instagram_id: selected.instagramId,
              instagram_username: selected.username,
              page_id: selected.pageId,
              page_name: selected.pageName,
              page_access_token_encrypted: encryptPageAccessToken(selected.accessToken),
              connected: true,
              connected_at: new Date().toISOString(),
            }),
            agentId,
          ]
        );
      } catch (saveErr) {
        if (isAccountUniqueViolation(saveErr)) throw instagramAccountAlreadyConnectedError();
        throw saveErr;
      }
      if (signupSessionId) {
        void deleteSignupSession(signupSessionId);
      }

      // 9. Ensure 'instagram' is in channels array
      await query(
        `UPDATE agents
         SET channels = (
           SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
           FROM jsonb_array_elements_text(COALESCE(channels, '[]'::jsonb) || '["instagram"]'::jsonb) elem
         )
         WHERE id = $1`,
        [agentId]
      );

      console.log(`[instagram-signup] Agent ${agentId} connected to Instagram account ${selected.instagramId} (Page ${selected.pageId})`);

      res.json({
        success: true,
        instagramId: selected.instagramId,
        instagramUsername: selected.username,
        webhookUrl: `${env.API_URL}/api/instagram/webhook`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/instagram/status/:agentId ───────────────────────────────────────
router.get(
  '/status/:agentId',
  requireAuth,
  orgContext,
  validateUUID('agentId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['agentId']);
      const result = await query<{
        id: string;
        instagram_config: Record<string, unknown>;
        channels: string[];
      }>(
        'SELECT id, instagram_config, channels FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );

      const agent = result.rows[0];
      if (!agent) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      const cfg = agent.instagram_config ?? {};
      res.json({
        connected: !!(cfg['connected']),
        instagramId: cfg['instagram_id'] ?? null,
        instagramUsername: cfg['instagram_username'] ?? null,
        webhookUrl: `${env.API_URL}/api/instagram/webhook`,
        channelEnabled: (agent.channels ?? []).includes('instagram'),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/instagram/disconnect/:agentId ────────────────────────────────
router.delete(
  '/disconnect/:agentId',
  requireAuth,
  orgContext,
  validateUUID('agentId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['agentId']);
      const agentCheck = await query<{ id: string; instagram_config: Record<string, unknown> }>(
        'SELECT id, instagram_config FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      const agent = agentCheck.rows[0];
      if (!agent) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      // Stop Meta from delivering this account's events to us via its linked Page (best effort)
      const cfg = agent.instagram_config ?? {};
      // Skipped when the same Page still feeds a Messenger agent: unsubscribing removes the whole app
      // subscription for that Page, which would also stop its Messenger webhooks.
      const pageStillUsed = cfg['page_id']
        ? (await query(
            `SELECT 1 FROM agents
             WHERE facebook_config->>'page_id' = $1
               AND (facebook_config->>'connected')::boolean = true
             LIMIT 1`,
            [String(cfg['page_id'])]
          )).rows.length > 0
        : false;
      if (cfg['page_id'] && cfg['page_access_token_encrypted'] && !pageStillUsed) {
        try {
          await unsubscribePageFromApp(
            String(cfg['page_id']),
            decryptPageAccessToken(String(cfg['page_access_token_encrypted']))
          );
        } catch {
          // Token may be revoked or undecryptable — the local config is cleared regardless
        }
      }

      await query(
        `UPDATE agents
         SET instagram_config = '{"instagram_id":null,"page_id":null,"page_access_token_encrypted":null,"connected":false}'::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [agentId]
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
