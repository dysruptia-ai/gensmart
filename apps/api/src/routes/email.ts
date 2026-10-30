import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import { checkChannelAccess } from '../middleware/planLimits';
import { validateUUID } from '../middleware/validateUUID';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { escapeHtmlWithBreaks } from '../utils/html';
import {
  agentInboundAddress,
  detectAutomatedEmail,
  downloadAttachments,
  extractPdfText,
  fillContactPhone,
  findOrCreateEmailContact,
  fetchReceivedEmail,
  formatAttachmentNotice,
  isEmailChannelConfigured,
  nextThread,
  parseAddress,
  readThread,
  resolveAgentId,
  saveThread,
  sendEmailReply,
  signatureToText,
  verifyResendWebhook,
} from '../services/email.service';
import type { EmailConfig, ResendReceivedEvent } from '../services/email.service';
import { buildReferences, classifyFormFields, detectFormSubmission, extractFormFields } from '../services/email-parsing';
import { pushToBuffer } from '../services/message-buffer.service';
import type { BufferItem } from '../services/message-buffer.service';
import { PLAN_LIMITS } from '@gensmart/shared';

const router = Router();

const DEDUPE_TTL_SECONDS = 7 * 24 * 3600;
const SENDER_LIMIT_PER_HOUR = 20;

const DISCONNECTED_CONFIG: EmailConfig = {
  connected: false,
  inbound_address: null,
  reply_from_name: '',
  signature_html: '',
  auto_reply_enabled: false,
  auto_reply_text: '',
  form_field_separator: 'colon',
};

// ── Incoming message pipeline ─────────────────────────────────────────────────

interface EmailAgentRow {
  id: string;
  name: string;
  organization_id: string;
  message_buffer_seconds: number;
  email_config: EmailConfig;
  status: string;
}

async function processEmail(agent: EmailAgentRow, event: ResendReceivedEvent): Promise<void> {
  const { email_id: emailId, subject, message_id: messageId } = event.data;

  // Svix retries on non-2xx and Resend may redeliver: one email is processed once
  const firstTime = await redis.set(`email:seen:${emailId}`, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX');
  if (!firstTime) {
    console.log(`[email] Duplicate delivery ${emailId} — ignoring`);
    return;
  }

  const sender = parseAddress(event.data.from);
  if (!sender) {
    console.warn(`[email] Unparseable From on ${emailId} — ignoring`);
    return;
  }
  if (sender.address.endsWith(`@${env.EMAIL_INBOUND_DOMAIN}`)) {
    console.warn(`[email] Sender is our own inbound domain (${emailId}) — ignoring to avoid a loop`);
    return;
  }

  const received = await fetchReceivedEmail(emailId);

  // Loop protection — must run before anything is generated or sent
  const automated = detectAutomatedEmail(received.headers, sender.address);
  if (automated) {
    console.log(`[email] Automated email ${emailId} (${automated}) — no agent reply`);
    return;
  }

  // A spoofed From could otherwise make the agent mail an arbitrary address repeatedly
  const rateKey = `email:rl:${agent.id}:${sender.address}`;
  const count = await redis.incr(rateKey);
  if (count === 1) await redis.expire(rateKey, 3600);
  if (count > SENDER_LIMIT_PER_HOUR) {
    console.warn(`[email] Sender rate limit hit for agent ${agent.id} — ignoring ${emailId}`);
    return;
  }

  const orgResult = await query<{ plan: string }>('SELECT plan FROM organizations WHERE id = $1', [agent.organization_id]);
  const plan = (orgResult.rows[0]?.plan ?? 'solo') as keyof typeof PLAN_LIMITS;
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.solo;

  // Attachments: images (vision plans only) and PDFs (text extracted)
  let messageText = received.text;
  const imageItems: BufferItem[] = [];
  let skipped = 0;
  const readNames: string[] = [];
  if (received.attachmentMetas.length > 0) {
    const downloaded = await downloadAttachments(emailId, received.attachmentMetas);
    skipped = downloaded.skipped;
    for (const att of downloaded.attachments) {
      if (att.kind === 'image') {
        if (!planLimits.imageVision) { skipped++; continue; }
        imageItems.push({ type: 'image', content: '', mimeType: att.mimeType, data: att.data.toString('base64') });
        readNames.push(att.filename);
      } else {
        try {
          const pdfText = await extractPdfText(att.data);
          if (pdfText) {
            messageText += `\n\n[Content of attached PDF "${att.filename}"]\n${pdfText}`;
            readNames.push(att.filename);
          } else {
            skipped++;
          }
        } catch (err) {
          skipped++;
          console.warn(`[email] PDF text extraction failed for "${att.filename}":`, (err as Error).message);
        }
      }
    }
  }
  const notice = formatAttachmentNotice(readNames, skipped);
  if (notice) messageText = `${messageText}\n\n${notice}`.trim();

  if (!messageText.trim() && imageItems.length === 0) {
    console.log(`[email] Email ${emailId} has no new text (only quoted history) — ignoring`);
    return;
  }
  if (!messageText.trim()) messageText = '[Image]';

  // Website-form notifications arrive from a technical sender (wordpress@site, ...): the lead's own email or
  // phone inside the body is the identity, otherwise every lead of one site collapses into one contact.
  // messageText (what the LLM sees) is untouched.
  const separator = agent.email_config.form_field_separator ?? 'colon';
  const formFields = detectFormSubmission(received.text, separator) ? extractFormFields(received.text, separator) : null;
  const classified = formFields ? classifyFormFields(formFields) : null;
  // A form pointing the agent at its own inbound address would only bounce replies back to us
  const formEmail = classified?.email && !classified.email.endsWith(`@${env.EMAIL_INBOUND_DOMAIN}`) ? classified.email : null;
  const effectiveEmail = formEmail ?? sender.address;
  const effectiveName = classified?.name ?? sender.name;
  const effectivePhone = !formEmail ? classified?.phone ?? null : null;

  const contactId = await findOrCreateEmailContact(agent, {
    email: formEmail ?? (effectivePhone ? null : sender.address),
    phone: effectivePhone,
    name: effectiveName,
  });
  if (classified && Object.keys(classified.custom).length > 0) {
    await query(
      `UPDATE contacts SET custom_variables = COALESCE(custom_variables, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(classified.custom), contactId]
    );
  }
  // Email decides the identity, but a phone the form also carried is kept (only if the contact has none yet)
  if (classified?.phone && formEmail) {
    await fillContactPhone(contactId, classified.phone);
  }

  const existingConv = await query<{ id: string; status: string; channel_metadata: Record<string, unknown> | null }>(
    `SELECT id, status, channel_metadata FROM conversations
     WHERE agent_id = $1 AND contact_id = $2 AND channel = 'email' AND status != 'closed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [agent.id, contactId]
  );

  let convId: string;
  let convStatus: string;
  const isNewConversation = !existingConv.rows[0];
  if (existingConv.rows[0]) {
    convId = existingConv.rows[0].id;
    convStatus = existingConv.rows[0].status;
  } else {
    const newConv = await query<{ id: string; status: string }>(
      `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status, channel_metadata, created_at, updated_at)
       VALUES ($1, $2, $3, 'email', 'active', '{}'::jsonb, NOW(), NOW())
       RETURNING id, status`,
      [agent.organization_id, agent.id, contactId]
    );
    convId = newConv.rows[0]!.id;
    convStatus = newConv.rows[0]!.status;
  }

  // Thread bookkeeping: the reply answers THIS email, and its References chain continues the thread
  const previousThread = readThread(existingConv.rows[0]?.channel_metadata);
  const thread = nextThread(previousThread, {
    subject,
    fromAddress: effectiveEmail,
    messageId,
    referencesHeader: Object.entries(received.headers).find(([k]) => k.toLowerCase() === 'references')?.[1],
  });
  await saveThread(convId, thread);

  // One-time acknowledgement when a conversation opens; the agent's real answer follows as a separate email
  if (isNewConversation && agent.email_config.auto_reply_enabled && agent.email_config.auto_reply_text?.trim()) {
    try {
      const autoMessageId = await sendEmailReply({
        agentId: agent.id,
        agentName: agent.name,
        config: agent.email_config,
        to: effectiveEmail,
        subject,
        text: agent.email_config.auto_reply_text.trim(),
        inReplyTo: thread.last_message_id,
        references: thread.references,
        includeSignature: true,
      });
      await saveThread(convId, { ...thread, references: buildReferences(thread.references, undefined, autoMessageId) });
    } catch (err) {
      console.error(`[email] Auto-reply failed for conv ${convId}:`, (err as Error).message);
    }
  }

  // During human takeover — save message + notify dashboard, skip LLM
  if (convStatus === 'human_takeover') {
    console.log(`[email] Conversation ${convId} in human takeover — saving message, skipping LLM`);

    const userMsgMeta: Record<string, unknown> = {};
    if (imageItems.length > 0) {
      userMsgMeta['hasImages'] = true;
      userMsgMeta['imageCount'] = imageItems.length;
      userMsgMeta['images'] = imageItems.map((i) => ({ mimeType: i.mimeType, hasCaption: false }));
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

  // Push to the message buffer: images first (the text rides as the first image's caption), else plain text
  if (imageItems.length > 0) {
    const [first, ...rest] = imageItems;
    await pushToBuffer(convId, agent.id, agent.organization_id, { ...first!, content: messageText }, agent.message_buffer_seconds);
    for (const item of rest) {
      await pushToBuffer(convId, agent.id, agent.organization_id, item, agent.message_buffer_seconds);
    }
  } else {
    await pushToBuffer(convId, agent.id, agent.organization_id, messageText, agent.message_buffer_seconds);
  }
}

// ── POST /api/email/webhook ───────────────────────────────────────────────────
// Resend signs with Svix over the RAW body (express.raw registered before express.json in index.ts).
// Nothing is parsed or looked up before the signature checks out.
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  let event: ResendReceivedEvent;
  try {
    if (!Buffer.isBuffer(req.body)) throw new Error('Raw body unavailable');
    event = verifyResendWebhook(req.body, req.headers);
  } catch (err) {
    console.warn('[email] Webhook signature verification failed:', (err as Error).message);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (event.type !== 'email.received') {
    res.status(200).json({ ok: true });
    return;
  }

  const agentId = resolveAgentId([...(event.data.to ?? []), ...(event.data.received_for ?? [])], env.EMAIL_INBOUND_DOMAIN);

  let agent: EmailAgentRow | undefined;
  if (agentId) {
    try {
      const result = await query<EmailAgentRow>(
        `SELECT id, name, organization_id, message_buffer_seconds, email_config, status
         FROM agents
         WHERE id = $1 AND (email_config->>'connected')::boolean = true
         LIMIT 1`,
        [agentId]
      );
      agent = result.rows[0];
    } catch (err) {
      // Non-2xx makes Svix retry later
      console.error('[email] Webhook agent lookup failed:', (err as Error).message);
      res.status(500).json({ error: 'internal_error' });
      return;
    }
  }

  // Acknowledge immediately: body/attachment fetching and the LLM pipeline can take longer than Svix waits
  res.status(200).json({ ok: true });

  if (!agent) {
    console.log(`[email] No connected agent for recipients of ${event.data.email_id} — ignoring`);
    return;
  }
  try {
    if (agent.status !== 'active') {
      console.log(`[email] Agent ${agent.id} is not active — ignoring email`);
      return;
    }
    await processEmail(agent, event);
  } catch (err) {
    console.error('[email] Webhook processing error:', err);
    // Let a Resend redelivery or manual replay reprocess it
    await redis.del(`email:seen:${event.data.email_id}`).catch(() => undefined);
  }
});

// ── POST /api/email/connect ───────────────────────────────────────────────────
// Idempotent: creates or updates email_config. There is no external handshake — the address is a wildcard
// on our inbound domain — so "connect" just activates routing for this agent.
const connectSchema = z.object({
  agentId: z.string().uuid(),
  replyFromName: z.string().trim().max(60).default(''),
  signature: z.string().max(1000).default(''),
  autoReplyEnabled: z.boolean().default(false),
  autoReplyText: z.string().trim().max(2000).default(''),
  formFieldSeparator: z.enum(['colon', 'equals', 'both']).default('colon'),
}).refine((v) => !v.autoReplyEnabled || v.autoReplyText.length > 0, {
  message: 'Auto-reply text is required when auto-reply is enabled',
  path: ['autoReplyText'],
});

router.post(
  '/connect',
  requireAuth,
  orgContext,
  checkChannelAccess('email'),
  validate(connectSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof connectSchema>;

      if (!isEmailChannelConfigured()) {
        throw new AppError(503, 'Email is not configured on this server', 'NOT_CONFIGURED');
      }

      const agentCheck = await query<{ id: string }>(
        'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
        [body.agentId, req.org!.id]
      );
      if (!agentCheck.rows[0]) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      const inboundAddress = agentInboundAddress(body.agentId, env.EMAIL_INBOUND_DOMAIN);
      const config: EmailConfig = {
        connected: true,
        inbound_address: inboundAddress,
        reply_from_name: body.replyFromName,
        // Plain text in, escaped HTML stored: nothing the user types can inject markup into outgoing mail
        signature_html: body.signature.trim() ? escapeHtmlWithBreaks(body.signature.trim()) : '',
        auto_reply_enabled: body.autoReplyEnabled,
        auto_reply_text: body.autoReplyText,
        form_field_separator: body.formFieldSeparator,
      };

      await query(`UPDATE agents SET email_config = $1::jsonb, updated_at = NOW() WHERE id = $2`, [JSON.stringify(config), body.agentId]);

      await query(
        `UPDATE agents
         SET channels = (
           SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
           FROM jsonb_array_elements_text(COALESCE(channels, '[]'::jsonb) || '["email"]'::jsonb) elem
         )
         WHERE id = $1`,
        [body.agentId]
      );

      res.json({ success: true, inboundAddress });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/email/disconnect ────────────────────────────────────────────────
const disconnectSchema = z.object({ agentId: z.string().uuid() });

router.post(
  '/disconnect',
  requireAuth,
  orgContext,
  validate(disconnectSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { agentId } = req.body as z.infer<typeof disconnectSchema>;
      const result = await query(
        `UPDATE agents SET email_config = $1::jsonb, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
        [JSON.stringify(DISCONNECTED_CONFIG), agentId, req.org!.id]
      );
      if (!result.rowCount) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/email/status/:agentId ────────────────────────────────────────────
router.get(
  '/status/:agentId',
  requireAuth,
  orgContext,
  validateUUID('agentId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['agentId']);
      const result = await query<{ email_config: EmailConfig | null; channels: string[] }>(
        'SELECT email_config, channels FROM agents WHERE id = $1 AND organization_id = $2',
        [agentId, req.org!.id]
      );
      const agent = result.rows[0];
      if (!agent) {
        throw new AppError(404, 'Agent not found', 'NOT_FOUND');
      }

      const cfg = agent.email_config ?? DISCONNECTED_CONFIG;
      res.json({
        connected: !!cfg.connected,
        // Always derivable from the agent id, so it can be shown before connecting
        inboundAddress: agentInboundAddress(agentId, env.EMAIL_INBOUND_DOMAIN),
        replyFromName: cfg.reply_from_name ?? '',
        signature: signatureToText(cfg.signature_html ?? ''),
        autoReplyEnabled: !!cfg.auto_reply_enabled,
        autoReplyText: cfg.auto_reply_text ?? '',
        formFieldSeparator: cfg.form_field_separator ?? 'colon',
        channelEnabled: (agent.channels ?? []).includes('email'),
        serverConfigured: isEmailChannelConfigured(),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
