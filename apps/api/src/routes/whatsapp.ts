import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validateUUID } from '../middleware/validateUUID';
import { query } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import {
  markAsRead,
  verifyWebhookSignature,
  encryptAccessToken,
  decryptAccessToken,
  getPhoneNumberInfo,
  downloadMedia,
  downloadAudio,
  transcribeAudio,
  resolveAccessToken,
} from '../services/whatsapp.service';
import { pushToBuffer } from '../services/message-buffer.service';
import type { BufferItem } from '../services/message-buffer.service';
import { PLAN_LIMITS } from '@gensmart/shared';

const router = Router();

// ── GET /api/whatsapp/webhook ─────────────────────────────────────────────────
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
    // First try: platform-level verify token (global, for Embedded Signup)
    const { getSettingValue } = await import('../services/platform-settings.service');
    let platformVerifyToken = '';
    try {
      platformVerifyToken = await getSettingValue('whatsapp_verify_token');
    } catch {
      // Setting might not exist yet
    }

    if (platformVerifyToken && token === platformVerifyToken) {
      console.log('[whatsapp] Webhook verified via platform verify token');
      res.status(200).send(challenge);
      return;
    }

    // Fallback: per-agent verify token (backward compat with existing agents)
    const result = await query<{ id: string }>(
      `SELECT id FROM agents
       WHERE whatsapp_config->>'verify_token' = $1
         AND (whatsapp_config->>'connected')::boolean = true`,
      [token]
    );

    if (result.rows.length > 0) {
      console.log('[whatsapp] Webhook verified for agent:', result.rows[0]!.id);
      res.status(200).send(challenge);
    } else {
      console.log('[whatsapp] Webhook verification failed — token not found in platform or agents');
      res.status(403).json({ error: 'Verification failed' });
    }
  } catch (err) {
    console.error('[whatsapp] Webhook verification error:', err);
    res.status(403).json({ error: 'Verification failed' });
  }
});

// ── POST /api/whatsapp/webhook ────────────────────────────────────────────────
// Handle incoming WhatsApp messages from Meta Cloud API
// Must respond 200 immediately — Meta requires fast acknowledgment
router.post(
  '/webhook',
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    // Acknowledge immediately
    res.status(200).json({ status: 'ok' });

    // Process asynchronously
    try {
      // req.body is a Buffer (express.raw registered before express.json in index.ts)
      const rawBuffer: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const appSecret = env.WHATSAPP_APP_SECRET || env.META_APP_SECRET;
      if (appSecret) {
        const signature = req.headers['x-hub-signature-256'] as string;
        if (!signature || !verifyWebhookSignature(rawBuffer.toString(), signature, appSecret)) {
          console.warn('[whatsapp] Invalid webhook signature — ignoring');
          return;
        }
      } else {
        console.warn('[whatsapp] No app secret configured — skipping signature validation');
      }

      // Parse body from raw buffer
      let parsedBody: Record<string, unknown>;
      try {
        parsedBody = JSON.parse(rawBuffer.toString()) as Record<string, unknown>;
      } catch {
        console.warn('[whatsapp] Failed to parse webhook body');
        return;
      }

      const body = parsedBody as {
        entry?: Array<{
          changes?: Array<{
            value?: {
              metadata?: { phone_number_id?: string };
              messages?: Array<{
                id: string;
                from: string;
                type: string;
                text?: { body: string };
                image?: {
                  id: string;
                  mime_type: string;
                  sha256: string;
                  caption?: string;
                };
                audio?: {
                  id: string;
                  mime_type: string;
                };
                referral?: {
                  source_url?: string;
                  source_type?: string;
                  source_id?: string;
                  headline?: string;
                  body?: string;
                  media_type?: string;
                  image_url?: string;
                  video_url?: string;
                  thumbnail_url?: string;
                };
                context?: {
                  referred_product?: Record<string, unknown>;
                };
                timestamp: string;
              }>;
              statuses?: unknown[];
            };
          }>;
        }>;
      };

      const entry = body?.entry?.[0];
      const value = entry?.changes?.[0]?.value;

      // Skip status updates
      if (!value?.messages?.length) return;

      const message = value.messages[0];
      const phoneNumberId = value.metadata?.phone_number_id;

      // Handle text and image messages
      if (message.type !== 'text' && message.type !== 'image' && message.type !== 'audio') {
        console.log(`[whatsapp] Skipping unsupported message type: ${message.type}`);
        return;
      }

      const fromPhone = message.from;
      const messageId = message.id;

      if (!fromPhone || !phoneNumberId) return;

      // Capture Meta Ads referral if present (Click-to-WhatsApp Ads)
      const referral = message.referral ?? null;
      const referredProduct = message.context?.referred_product ?? null;

      // Extract content based on message type
      let messageText = '';
      let imageMediaId: string | null = null;
      let imageCaption = '';
      let audioMediaId: string | null = null;

      if (message.type === 'text') {
        messageText = message.text?.body ?? '';
        if (!messageText) return;
      } else if (message.type === 'image') {
        imageCaption = message.image?.caption ?? '';
        imageMediaId = message.image?.id ?? null;

        if (!imageMediaId) {
          console.log('[whatsapp] Image message missing media ID');
          return;
        }

        messageText = imageCaption || '[Image]';
      } else if (message.type === 'audio') {
        audioMediaId = message.audio?.id ?? null;
        if (!audioMediaId) {
          console.log('[whatsapp] Audio message missing media ID');
          return;
        }
        messageText = '[Voice message]';
      }

      // Find active agent by phone_number_id
      const agentResult = await query<{
        id: string;
        organization_id: string;
        message_buffer_seconds: number;
        whatsapp_config: Record<string, unknown>;
        status: string;
      }>(
        `SELECT id, organization_id, message_buffer_seconds, whatsapp_config, status
         FROM agents
         WHERE (whatsapp_config->>'phone_number_id') = $1
           AND (whatsapp_config->>'connected')::boolean = true
           AND status = 'active'
         LIMIT 1`,
        [phoneNumberId]
      );

      const agent = agentResult.rows[0];
      if (!agent) {
        console.log(`[whatsapp] No active agent for phone_number_id: ${phoneNumberId}`);
        return;
      }

      // Check plan — Free cannot use WhatsApp
      const orgResult = await query<{ plan: string }>(
        'SELECT plan FROM organizations WHERE id = $1',
        [agent.organization_id]
      );
      const plan = (orgResult.rows[0]?.plan ?? 'free') as keyof typeof PLAN_LIMITS;
      if (plan === 'free') {
        console.log(`[whatsapp] Org ${agent.organization_id} on free plan — WhatsApp not available`);
        return;
      }

      const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

      // Download image if this is an image message (gate by plan)
      let imageBufferItem: BufferItem | null = null;
      if (imageMediaId) {
        if (!planLimits.imageVision) {
          // Plan doesn't support image analysis — skip download, notify via buffer
          console.log(`[whatsapp] Org ${agent.organization_id} on ${plan} plan — image vision not available`);
          imageMediaId = null;
          messageText = imageCaption
            ? `${imageCaption}\n\n[The user also sent an image, but image analysis is not available on your current plan. Let them know they can upgrade to Pro for image analysis.]`
            : '[The user sent an image, but image analysis is not available on your current plan. Please let them know they can upgrade to Pro for image analysis.]';
        } else {
          const waConfig = agent.whatsapp_config;
          try {
            const accessToken = await resolveAccessToken(waConfig);
            const media = await downloadMedia(imageMediaId, accessToken);
            imageBufferItem = {
              type: 'image',
              content: imageCaption,
              mimeType: media.mimeType,
              data: media.data,
            };
            console.log(`[whatsapp] Downloaded image: ${media.mimeType}, ${Math.round(media.data.length * 0.75 / 1024)}KB`);
          } catch (err) {
            console.error('[whatsapp] Failed to download image:', (err as Error).message);
            // Continue without image — treat as text-only with caption
          }
        }
      }

      // Download and transcribe audio if this is an audio message (gate by plan)
      let audioTranscription: string | null = null;
      if (audioMediaId) {
        if (!planLimits.voiceMessages) {
          // Plan doesn't support voice messages — skip download, notify via buffer
          console.log(`[whatsapp] Org ${agent.organization_id} on ${plan} plan — voice messages not available`);
          audioMediaId = null;
          messageText = '[The user sent a voice message, but voice messages are not available on your current plan. Please let them know they can type their message instead.]';
        } else {
          const waConfigAudio = agent.whatsapp_config;
          try {
            const accessToken = await resolveAccessToken(waConfigAudio);
            const audio = await downloadAudio(audioMediaId, accessToken);
              console.log(`[whatsapp] Downloaded audio: ${audio.mimeType}, ${Math.round(audio.buffer.length / 1024)}KB`);

              const transcription = await transcribeAudio(audio.buffer, audio.mimeType);
              if (transcription.trim()) {
                audioTranscription = transcription.trim();
                messageText = audioTranscription;
                console.log(`[whatsapp] Audio transcribed: "${audioTranscription.slice(0, 100)}${audioTranscription.length > 100 ? '...' : ''}"`);
              } else {
                console.warn('[whatsapp] Whisper returned empty transcription');
                messageText = '[Voice message — could not transcribe]';
              }
            } catch (err) {
              console.error('[whatsapp] Failed to download/transcribe audio:', (err as Error).message);
              messageText = '[Voice message — transcription failed]';
            }
        }
      }

      // Find or create contact by phone
      const existingContact = await query<{ id: string }>(
        'SELECT id FROM contacts WHERE organization_id = $1 AND phone = $2 LIMIT 1',
        [agent.organization_id, fromPhone]
      );

      let contactId: string;
      if (existingContact.rows[0]) {
        contactId = existingContact.rows[0].id;
        // Also set agent_id if missing
        await query(
          'UPDATE contacts SET agent_id = COALESCE(agent_id, $1), updated_at = NOW() WHERE id = $2',
          [agent.id, contactId]
        );
      } else {
        const newContact = await query<{ id: string }>(
          `INSERT INTO contacts (organization_id, agent_id, phone, source_channel, created_at, updated_at)
           VALUES ($1, $2, $3, 'whatsapp', NOW(), NOW())
           RETURNING id`,
          [agent.organization_id, agent.id, fromPhone]
        );
        contactId = newContact.rows[0]!.id;
      }

      // Find or create active conversation
      const existingConv = await query<{ id: string; status: string }>(
        `SELECT id, status FROM conversations
         WHERE agent_id = $1 AND contact_id = $2 AND channel = 'whatsapp' AND status != 'closed'
         ORDER BY created_at DESC
         LIMIT 1`,
        [agent.id, contactId]
      );

      let convId: string;
      let convStatus: string;

      if (existingConv.rows[0]) {
        convId = existingConv.rows[0].id;
        convStatus = existingConv.rows[0].status;

        // If this is the first message with a referral on an existing conv, update channel_metadata
        if (referral) {
          await query(
            `UPDATE conversations SET channel_metadata = COALESCE(channel_metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify({ referral, referredProduct }), convId]
          );
        }
      } else {
        const channelMeta: Record<string, unknown> = {};
        if (referral) {
          channelMeta['referral'] = referral;
          if (referredProduct) channelMeta['referredProduct'] = referredProduct;
        }

        const newConv = await query<{ id: string; status: string }>(
          `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status, channel_metadata, created_at, updated_at)
           VALUES ($1, $2, $3, 'whatsapp', 'active', $4::jsonb, NOW(), NOW())
           RETURNING id, status`,
          [agent.organization_id, agent.id, contactId, JSON.stringify(channelMeta)]
        );
        convId = newConv.rows[0]!.id;
        convStatus = newConv.rows[0]!.status;
      }

      // Mark message as read (fire and forget) — always, regardless of takeover status
      const waConfig = agent.whatsapp_config;
      try {
        const accessToken = await resolveAccessToken(waConfig);
        markAsRead(phoneNumberId, accessToken, messageId).catch(() => {});
      } catch {
        // Ignore token errors for mark-as-read — non-critical
      }

      // During human takeover — save message + notify dashboard, skip LLM
      if (convStatus === 'human_takeover') {
        console.log(`[whatsapp] Conversation ${convId} in human takeover — saving message, skipping LLM`);

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
    } catch (err) {
      console.error('[whatsapp] Webhook processing error:', err);
    }
  }
);

// ── POST /api/whatsapp/connect ────────────────────────────────────────────────
router.post(
  '/connect',
  requireAuth,
  orgContext,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgResult = await query<{ plan: string }>(
        'SELECT plan FROM organizations WHERE id = $1',
        [req.org!.id]
      );
      if (orgResult.rows[0]?.plan === 'free') {
        throw new AppError(403, 'WhatsApp requires Starter plan or higher', 'PLAN_LIMIT');
      }

      const appSecret = env.WHATSAPP_APP_SECRET || env.META_APP_SECRET;
      const verifyToken = env.WHATSAPP_VERIFY_TOKEN || env.META_VERIFY_TOKEN;
      if (!appSecret || !verifyToken) {
        throw new AppError(503, 'WhatsApp is not configured on this server. Contact support.', 'NOT_CONFIGURED');
      }

      const { agentId, phoneNumberId, wabaId, accessToken } = req.body as {
        agentId: string;
        phoneNumberId: string;
        wabaId: string;
        accessToken: string;
      };

      if (!agentId || !phoneNumberId || !wabaId) {
        throw new AppError(400, 'Missing required fields: agentId, phoneNumberId, wabaId', 'VALIDATION_ERROR');
      }

      // Verify agent belongs to org
      const agentCheck = await query<{ id: string; whatsapp_config: Record<string, unknown> }>(
        'SELECT id, whatsapp_config FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      // If no accessToken in body, use the one saved via Embedded Signup
      let finalAccessToken = accessToken?.trim() ?? '';
      if (!finalAccessToken) {
        const savedEncrypted = agentCheck.rows[0]!.whatsapp_config?.['access_token_encrypted'] as string | undefined;
        if (savedEncrypted) {
          finalAccessToken = decryptAccessToken(savedEncrypted);
        } else {
          // Fallback to platform token
          try {
            const { getWhatsAppToken } = await import('../services/platform-settings.service');
            finalAccessToken = await getWhatsAppToken();
            if (!finalAccessToken) {
              throw new AppError(400, 'No access token provided, saved, or configured at platform level.', 'VALIDATION_ERROR');
            }
          } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(400, 'No access token available. Please reconnect with Facebook.', 'VALIDATION_ERROR');
          }
        }
      }

      // Validate access token by calling Meta API
      let phoneDisplay = phoneNumberId;
      try {
        const info = await getPhoneNumberInfo(phoneNumberId, finalAccessToken);
        phoneDisplay = info.display_phone_number;
      } catch (tokenErr) {
        // If the token we tried was the platform token, try the user's FB token from Embedded Signup
        if (!accessToken?.trim()) {
          // We were using platform token and it failed — try user token from Embedded Signup if saved
          const savedEncrypted = agentCheck.rows[0]!.whatsapp_config?.['access_token_encrypted'] as string | undefined;
          if (savedEncrypted) {
            try {
              const userToken = decryptAccessToken(savedEncrypted);
              const info = await getPhoneNumberInfo(phoneNumberId, userToken);
              phoneDisplay = info.display_phone_number;
              // User token worked — use it instead
              finalAccessToken = userToken;
            } catch {
              throw new AppError(400, 'Neither platform token nor saved user token can access this phone number. Please ensure Dysruptia is assigned as a partner to this WABA with "Manage phone numbers" permission, then wait 5 minutes and try again.', 'INVALID_CREDENTIALS');
            }
          } else {
            throw new AppError(400, 'Platform token cannot access this phone number. Please ensure Dysruptia is assigned as a partner to this WABA with "Manage phone numbers" permission, then wait 5 minutes and try again.', 'INVALID_CREDENTIALS');
          }
        } else {
          throw new AppError(400, 'Invalid access token or phone number ID. Please check your credentials.', 'INVALID_CREDENTIALS');
        }
      }

      const encryptedToken = encryptAccessToken(finalAccessToken);
      const agentVerifyToken = crypto.randomUUID();

      // Build new whatsapp_config
      await query(
        `UPDATE agents
         SET whatsapp_config = $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            phone_number_id: phoneNumberId,
            waba_id: wabaId,
            access_token_encrypted: encryptedToken,
            verify_token: agentVerifyToken,
            connected: true,
          }),
          agentId,
        ]
      );

      // Ensure 'whatsapp' is in channels array
      await query(
        `UPDATE agents
         SET channels = (
           SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
           FROM jsonb_array_elements_text(COALESCE(channels, '[]'::jsonb) || '["whatsapp"]'::jsonb) elem
         )
         WHERE id = $1`,
        [agentId]
      );

      res.json({
        verifyToken: agentVerifyToken,
        webhookUrl: `${env.API_URL}/api/whatsapp/webhook`,
        phoneNumber: phoneDisplay,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/whatsapp/embedded-signup ────────────────────────────────────────
router.post(
  '/embedded-signup',
  requireAuth,
  orgContext,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgResult = await query<{ plan: string }>(
        'SELECT plan FROM organizations WHERE id = $1',
        [req.org!.id]
      );
      if (orgResult.rows[0]?.plan === 'free') {
        throw new AppError(403, 'WhatsApp requires Starter plan or higher', 'PLAN_LIMIT');
      }

      const fbAppId = env.FACEBOOK_APP_ID;
      const fbAppSecret = env.FACEBOOK_APP_SECRET;
      if (!fbAppId || !fbAppSecret) {
        throw new AppError(503, 'Facebook App credentials not configured on this server', 'NOT_CONFIGURED');
      }

      const { agentId, accessToken } = req.body as { agentId: string; accessToken: string };
      if (!agentId || !accessToken) {
        throw new AppError(400, 'Missing agentId or accessToken', 'VALIDATION_ERROR');
      }

      const agentCheck = await query<{ id: string }>(
        'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      // Save encrypted token only — user must supply Phone Number ID + WABA ID via /connect
      const encryptedToken = encryptAccessToken(accessToken);
      await query(
        `UPDATE agents
         SET whatsapp_config = jsonb_set(
               jsonb_set(
                 COALESCE(whatsapp_config, '{}'::jsonb),
                 '{access_token_encrypted}', to_jsonb($1::text)
               ),
               '{connected}', 'false'::jsonb
             ),
             updated_at = NOW()
         WHERE id = $2`,
        [encryptedToken, agentId]
      );

      res.json({
        success: true,
        message: 'Access token saved. Now enter your Phone Number ID and WABA ID below to complete setup.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/whatsapp/embedded-signup-complete ─────────────────────────────
// Full automated flow: discover WABA + phone, subscribe webhook, register number, connect agent
router.post(
  '/embedded-signup-complete',
  requireAuth,
  orgContext,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Plan check
      const orgResult = await query<{ plan: string }>(
        'SELECT plan FROM organizations WHERE id = $1',
        [req.org!.id]
      );
      if (orgResult.rows[0]?.plan === 'free') {
        throw new AppError(403, 'WhatsApp requires Starter plan or higher', 'PLAN_LIMIT');
      }

      const { agentId, fbAccessToken, selectedWabaId, selectedPhoneId } = req.body as {
        agentId: string;
        fbAccessToken: string;
        selectedWabaId?: string;
        selectedPhoneId?: string;
      };
      if (!agentId || !fbAccessToken) {
        throw new AppError(400, 'Missing agentId or fbAccessToken', 'VALIDATION_ERROR');
      }

      // 2. Verify agent belongs to org
      const agentCheck = await query<{ id: string }>(
        'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      // 3. Get the Platform System User token (needed for debug_token, webhook, registration)
      const { getWhatsAppToken } = await import('../services/platform-settings.service');
      const platformToken = await getWhatsAppToken();
      if (!platformToken) {
        throw new AppError(503, 'Platform WhatsApp token not configured. Contact admin.', 'NOT_CONFIGURED');
      }

      // 4. Use debug_token to discover shared WABAs from the Embedded Signup callback
      //    The user's FB token does NOT have scope for /me/whatsapp_business_accounts —
      //    Meta Embedded Signup exposes shared WABAs via granular_scopes in debug_token.
      console.log(`[embedded-signup] Using debug_token to discover shared WABAs for agent ${agentId}...`);

      const debugRes = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(fbAccessToken)}&access_token=${encodeURIComponent(platformToken)}`
      );
      if (!debugRes.ok) {
        const debugErr = await debugRes.json().catch(() => ({}));
        console.error('[embedded-signup] debug_token failed:', JSON.stringify(debugErr));
        throw new AppError(500, 'Failed to validate Facebook token', 'DEBUG_TOKEN_FAILED');
      }

      const debugData = await debugRes.json() as {
        data?: {
          is_valid?: boolean;
          granular_scopes?: Array<{
            scope: string;
            target_ids?: string[];
          }>;
        };
      };

      if (!debugData.data?.is_valid) {
        throw new AppError(401, 'Facebook token is invalid or expired', 'INVALID_FB_TOKEN');
      }

      // Extract WABA IDs from granular_scopes
      const sharedWabaIds: string[] = [];
      const wabaScope = debugData.data.granular_scopes?.find(
        (s) => s.scope === 'whatsapp_business_management'
      );
      if (wabaScope?.target_ids?.length) {
        sharedWabaIds.push(...wabaScope.target_ids);
      }

      if (sharedWabaIds.length === 0) {
        // Fallback: try whatsapp_business_messaging scope
        const msgScope = debugData.data.granular_scopes?.find(
          (s) => s.scope === 'whatsapp_business_messaging'
        );
        if (msgScope?.target_ids?.length) {
          sharedWabaIds.push(...msgScope.target_ids);
        }
      }

      if (sharedWabaIds.length === 0) {
        // Fallback for reconnections: granular_scopes may have the scope but no target_ids
        // Try using the user's FB token to list shared WABA IDs via the Business endpoint
        console.log('[embedded-signup] No target_ids in granular_scopes, trying fallback via user token...');

        try {
          // Try getting shared WABA list using the user's token
          const sharedWabaRes = await fetch(
            `https://graph.facebook.com/v21.0/me?fields=businesses{id,name}`,
            { headers: { Authorization: `Bearer ${fbAccessToken}` } }
          );

          if (sharedWabaRes.ok) {
            const bizData = await sharedWabaRes.json() as {
              businesses?: { data?: Array<{ id: string; name: string }> };
            };

            // For each business, try to find WABA
            for (const biz of bizData.businesses?.data ?? []) {
              const wabaRes = await fetch(
                `https://graph.facebook.com/v21.0/${biz.id}/owned_whatsapp_business_accounts?fields=id`,
                { headers: { Authorization: `Bearer ${fbAccessToken}` } }
              );
              if (wabaRes.ok) {
                const wabaData = await wabaRes.json() as { data?: Array<{ id: string }> };
                for (const w of wabaData.data ?? []) {
                  sharedWabaIds.push(w.id);
                }
              }
            }
          }

          if (sharedWabaIds.length === 0) {
            console.log('[embedded-signup] Business fallback failed, trying direct WABA list with user token...');

            // Last resort: try /me/whatsapp_business_accounts with the user token
            // (might work for some permission configurations)
            const directRes = await fetch(
              `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id`,
              { headers: { Authorization: `Bearer ${fbAccessToken}` } }
            );
            if (directRes.ok) {
              const directData = await directRes.json() as { data?: Array<{ id: string }> };
              for (const w of directData.data ?? []) {
                sharedWabaIds.push(w.id);
              }
            }
          }

          if (sharedWabaIds.length === 0) {
            // Final fallback: check WABAs already known to this organization only
            console.log('[embedded-signup] All user-token fallbacks failed, trying known WABAs from database for this org...');

            const knownWaba = await query<{ waba_id: string }>(
              `SELECT DISTINCT whatsapp_config->>'waba_id' as waba_id
               FROM agents
               WHERE whatsapp_config->>'waba_id' IS NOT NULL
                 AND organization_id = $1
               LIMIT 5`,
              [req.org!.id]
            );
            for (const row of knownWaba.rows) {
              if (row.waba_id) sharedWabaIds.push(row.waba_id);
            }

            // If still nothing for this org, try platform token to list WABAs the System User can access
            if (sharedWabaIds.length === 0) {
              console.log('[embedded-signup] No WABAs in DB for this org, trying platform token to list accessible WABAs...');
              try {
                const platformWabaRes = await fetch(
                  `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name`,
                  { headers: { Authorization: `Bearer ${platformToken}` } }
                );
                if (platformWabaRes.ok) {
                  const platformWabaData = await platformWabaRes.json() as { data?: Array<{ id: string }> };
                  for (const w of platformWabaData.data ?? []) {
                    sharedWabaIds.push(w.id);
                  }
                  if (sharedWabaIds.length > 0) {
                    console.log(`[embedded-signup] Platform token found ${sharedWabaIds.length} accessible WABA(s): ${sharedWabaIds.join(', ')}`);
                  }
                }
              } catch (platformErr) {
                console.warn('[embedded-signup] Platform token WABA list failed:', (platformErr as Error).message);
              }
            }
          }
        } catch (fallbackErr) {
          console.error('[embedded-signup] Fallback WABA discovery failed:', (fallbackErr as Error).message);
        }

        if (sharedWabaIds.length === 0) {
          console.error('[embedded-signup] All WABA discovery methods failed. Scopes:', JSON.stringify(debugData.data.granular_scopes));
          throw new AppError(400, 'Could not find your WhatsApp Business Account. Please use Manual Setup instead.', 'NO_WABA_SHARED');
        }

        console.log(`[embedded-signup] Fallback found ${sharedWabaIds.length} WABA(s): ${sharedWabaIds.join(', ')}`);
      }

      // If multiple WABAs found, return them for user selection
      if (sharedWabaIds.length > 1 && !selectedWabaId) {
        const wabaOptions: Array<{ id: string; name: string }> = [];
        for (const wId of sharedWabaIds.slice(0, 5)) {
          try {
            const wabaInfoRes = await fetch(
              `https://graph.facebook.com/v21.0/${wId}?fields=id,name`,
              { headers: { Authorization: `Bearer ${platformToken}` } }
            );
            if (wabaInfoRes.ok) {
              const wabaInfo = await wabaInfoRes.json() as { id: string; name?: string };
              wabaOptions.push({ id: wabaInfo.id, name: wabaInfo.name ?? wId });
            } else {
              wabaOptions.push({ id: wId, name: wId });
            }
          } catch {
            wabaOptions.push({ id: wId, name: wId });
          }
        }

        res.json({
          success: false,
          requiresSelection: 'waba',
          options: wabaOptions,
          fbAccessToken: fbAccessToken,
        });
        return;
      }

      const wabaId = selectedWabaId || sharedWabaIds[0]!;
      console.log(`[embedded-signup] Using WABA: ${wabaId}`);

      // 5. Get phone numbers from this WABA — try platform token first, fallback to user's FB token
      let phoneNumberId = '';
      let displayPhone = '';
      type PhoneDataType = { data?: Array<{ id: string; display_phone_number: string; verified_name?: string }> };
      let phoneData: PhoneDataType | null = null;

      const phoneRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${platformToken}` } }
      );

      if (phoneRes.ok) {
        phoneData = await phoneRes.json() as PhoneDataType;
        const phone = phoneData?.data?.[0];
        if (phone) {
          phoneNumberId = phone.id;
          displayPhone = phone.display_phone_number;
          console.log(`[embedded-signup] Found phone via platform token: ${phoneNumberId} (${displayPhone})`);
        }
      }

      // Fallback: if platform token can't see phones, try user's FB token
      if (!phoneNumberId) {
        console.log(`[embedded-signup] Platform token found no phones for WABA ${wabaId}, trying user FB token...`);
        try {
          const userPhoneRes = await fetch(
            `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
            { headers: { Authorization: `Bearer ${fbAccessToken}` } }
          );
          if (userPhoneRes.ok) {
            phoneData = await userPhoneRes.json() as PhoneDataType;
            const phone = phoneData?.data?.[0];
            if (phone) {
              phoneNumberId = phone.id;
              displayPhone = phone.display_phone_number;
              console.log(`[embedded-signup] Found phone via user FB token: ${phoneNumberId} (${displayPhone})`);
            }
          }
        } catch (fbErr) {
          console.warn('[embedded-signup] User FB token phone lookup failed:', (fbErr as Error).message);
        }
      }

      // If multiple phones found, return them for user selection
      if (phoneData?.data && phoneData.data.length > 1 && !selectedPhoneId) {
        const phoneOptions = phoneData.data.map((p) => ({
          id: p.id,
          name: p.display_phone_number || p.id,
          verifiedName: p.verified_name,
        }));

        res.json({
          success: false,
          requiresSelection: 'phone',
          options: phoneOptions,
          selectedWabaId: wabaId,
          fbAccessToken: fbAccessToken,
        });
        return;
      }

      // If user already selected a phone, use it
      if (selectedPhoneId && phoneData?.data) {
        const selected = phoneData.data.find((p) => p.id === selectedPhoneId);
        if (selected) {
          phoneNumberId = selected.id;
          displayPhone = selected.display_phone_number;
        }
      }

      if (!phoneNumberId) {
        console.error('[embedded-signup] No phone numbers found for WABA:', wabaId);
        throw new AppError(400, 'No phone number found in the shared WhatsApp Business Account. Please complete WhatsApp Business setup first.', 'NO_PHONE_FOUND');
      }

      // 6. Subscribe the webhook to this WABA using platform token
      console.log(`[embedded-signup] Subscribing webhook for WABA ${wabaId}...`);
      const subscribeRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${platformToken}`,
          },
        }
      );
      if (!subscribeRes.ok) {
        const subErr = await subscribeRes.json().catch(() => ({}));
        console.error('[embedded-signup] Webhook subscribe failed:', JSON.stringify(subErr));
        throw new AppError(500, 'Failed to subscribe webhook. Ensure the System User has whatsapp_business_management permission.', 'WEBHOOK_SUBSCRIBE_FAILED');
      }
      console.log(`[embedded-signup] Webhook subscribed for WABA ${wabaId}`);

      // 7. Register the phone number using platform token
      console.log(`[embedded-signup] Registering phone ${phoneNumberId}...`);
      const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit random pin
      const registerRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${platformToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin,
          }),
        }
      );
      if (!registerRes.ok) {
        const regErr = await registerRes.json().catch(() => ({}));
        const errorMsg = JSON.stringify(regErr);
        if (errorMsg.includes('already registered') || errorMsg.includes('already exists')) {
          console.log(`[embedded-signup] Phone ${phoneNumberId} already registered — continuing`);
        } else {
          console.error('[embedded-signup] Phone registration failed:', errorMsg);
          console.warn('[embedded-signup] Continuing despite registration error...');
        }
      } else {
        console.log(`[embedded-signup] Phone ${phoneNumberId} registered successfully`);
      }

      // 8. Validate the platform token can access this phone number
      let verifiedPhoneDisplay = displayPhone;
      try {
        const info = await getPhoneNumberInfo(phoneNumberId, platformToken);
        verifiedPhoneDisplay = info.display_phone_number || displayPhone;
      } catch {
        console.warn(`[embedded-signup] Platform token cannot access phone ${phoneNumberId} — using display from user token`);
      }

      // 9. Save agent config — NO user token stored, only phone_number_id + waba_id
      //    The platform token will be used via resolveAccessToken fallback
      const agentVerifyToken = crypto.randomUUID();
      await query(
        `UPDATE agents
         SET whatsapp_config = $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            phone_number_id: phoneNumberId,
            waba_id: wabaId,
            verify_token: agentVerifyToken,
            connected: true,
          }),
          agentId,
        ]
      );

      // 10. Ensure 'whatsapp' is in channels array
      await query(
        `UPDATE agents
         SET channels = (
           SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
           FROM jsonb_array_elements_text(COALESCE(channels, '[]'::jsonb) || '["whatsapp"]'::jsonb) elem
         )
         WHERE id = $1`,
        [agentId]
      );

      console.log(`[embedded-signup] Agent ${agentId} connected to WhatsApp: ${verifiedPhoneDisplay}`);

      res.json({
        success: true,
        phoneNumber: verifiedPhoneDisplay,
        phoneNumberId,
        wabaId,
        verifyToken: agentVerifyToken,
        webhookUrl: `${env.API_URL}/api/whatsapp/webhook`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/whatsapp/status/:agentId ─────────────────────────────────────────
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
        whatsapp_config: Record<string, unknown>;
        channels: string[];
      }>(
        'SELECT id, whatsapp_config, channels FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );

      const agent = result.rows[0];
      if (!agent) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      const cfg = agent.whatsapp_config ?? {};
      res.json({
        connected: !!(cfg['connected']),
        phoneNumberId: cfg['phone_number_id'] ?? null,
        wabaId: cfg['waba_id'] ?? null,
        verifyToken: cfg['verify_token'] ?? null,
        webhookUrl: `${env.API_URL}/api/whatsapp/webhook`,
        channelEnabled: (agent.channels ?? []).includes('whatsapp'),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/whatsapp/disconnect/:agentId ──────────────────────────────────
router.delete(
  '/disconnect/:agentId',
  requireAuth,
  orgContext,
  validateUUID('agentId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['agentId']);
      const agentCheck = await query<{ id: string }>(
        'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      await query(
        `UPDATE agents
         SET whatsapp_config = '{"phone_number_id":null,"waba_id":null,"access_token_encrypted":null,"verify_token":null,"connected":false}'::jsonb,
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
