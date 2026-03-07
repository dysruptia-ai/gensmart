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
  exchangeCodeForToken,
  getWABAAndPhoneNumber,
} from '../services/whatsapp.service';
import { pushToBuffer } from '../services/message-buffer.service';

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
      console.log('[whatsapp] Webhook verification failed — token not found');
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

      // Only handle text messages
      if (message.type !== 'text' || !message.text?.body) {
        console.log(`[whatsapp] Skipping non-text message type: ${message.type}`);
        return;
      }

      const fromPhone = message.from;
      const messageText = message.text.body;
      const messageId = message.id;

      if (!fromPhone || !messageText || !phoneNumberId) return;

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
      const plan = orgResult.rows[0]?.plan ?? 'free';
      if (plan === 'free') {
        console.log(`[whatsapp] Org ${agent.organization_id} on free plan — WhatsApp not available`);
        return;
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
      } else {
        const newConv = await query<{ id: string; status: string }>(
          `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'whatsapp', 'active', NOW(), NOW())
           RETURNING id, status`,
          [agent.organization_id, agent.id, contactId]
        );
        convId = newConv.rows[0]!.id;
        convStatus = newConv.rows[0]!.status;
      }

      // Skip if human takeover
      if (convStatus === 'human_takeover') {
        console.log(`[whatsapp] Conversation ${convId} is in human takeover — skipping`);
        return;
      }

      // Push to message buffer
      await pushToBuffer(convId, agent.id, agent.organization_id, messageText, agent.message_buffer_seconds);

      // Mark message as read (fire and forget)
      const waConfig = agent.whatsapp_config;
      if (waConfig?.access_token_encrypted) {
        try {
          const accessToken = decryptAccessToken(String(waConfig.access_token_encrypted));
          markAsRead(phoneNumberId, accessToken, messageId).catch(() => {});
        } catch {
          // Ignore decryption errors for mark-as-read
        }
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

      if (!agentId || !phoneNumberId || !wabaId || !accessToken) {
        throw new AppError(400, 'Missing required fields: agentId, phoneNumberId, wabaId, accessToken', 'VALIDATION_ERROR');
      }

      // Verify agent belongs to org
      const agentCheck = await query<{ id: string }>(
        'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      // Validate access token by calling Meta API
      let phoneDisplay = phoneNumberId;
      try {
        const info = await getPhoneNumberInfo(phoneNumberId, accessToken);
        phoneDisplay = info.display_phone_number;
      } catch {
        throw new AppError(400, 'Invalid access token or phone number ID. Please check your credentials.', 'INVALID_CREDENTIALS');
      }

      const encryptedToken = encryptAccessToken(accessToken);
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

      const { agentId, code } = req.body as { agentId: string; code: string };
      if (!agentId || !code) {
        throw new AppError(400, 'Missing agentId or code', 'VALIDATION_ERROR');
      }

      const agentCheck = await query<{ id: string }>(
        'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      const accessToken = await exchangeCodeForToken(code, fbAppId, fbAppSecret);

      // Fetch WABA ID and Phone Number ID from the Graph API
      const { wabaId, phoneNumberId, displayPhone } = await getWABAAndPhoneNumber(accessToken);

      const encryptedToken = encryptAccessToken(accessToken);
      const agentVerifyToken = crypto.randomUUID();

      await query(
        `UPDATE agents
         SET whatsapp_config = jsonb_build_object(
               'phone_number_id', $1::text,
               'waba_id', $2::text,
               'access_token_encrypted', $3::text,
               'verify_token', $4::text,
               'connected', true
             ),
             updated_at = NOW()
         WHERE id = $5`,
        [phoneNumberId, wabaId, encryptedToken, agentVerifyToken, agentId]
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
        success: true,
        phoneNumberId,
        wabaId,
        displayPhone,
        verifyToken: agentVerifyToken,
        webhookUrl: `${env.API_URL}/api/whatsapp/webhook`,
        message: `Connected! Phone: ${displayPhone}. Configure the webhook URL and Verify Token in your Meta app to finish setup.`,
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
