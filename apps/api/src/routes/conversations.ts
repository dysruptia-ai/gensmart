import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validateUUID } from '../middleware/validateUUID';
import { requireRole } from '../middleware/requireRole';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { PLAN_LIMITS } from '@gensmart/shared';
import { scoringQueue } from '../config/queues';
import { chat } from '../services/llm.service';
import { getIO } from '../config/websocket';
import { withoutReservedChannelKeys } from '../services/channel-metadata-keys';
import {
  HANDOFF_ACTIVE_SQL,
  INBOX_FROM,
  NEEDS_SQL,
  WAITING_SINCE_SQL,
  buildCountsGroupQuery,
  buildCountsQuery,
  buildInboxConditions,
  followUpPendingSql,
  inboxOrderBy,
  parseInboxView,
} from '../services/inbox-query.service';
import {
  type ConversationEvent,
  SNOOZE_MAX_DAYS,
  TRANSFER_NOTE_MAX,
  emitConversationChange,
  getOrgTimezone,
  listEvents,
  parseOutcome,
  recordEventSafe,
  transferNotificationText,
} from '../services/conversation-events.service';
import { createNotification } from '../services/notification.service';

type PlanKey = keyof typeof PLAN_LIMITS;

const router = Router();


// All conversation routes require auth + orgContext
router.use(requireAuth, orgContext);

// ── GET /api/conversations ───────────────────────────────────────────────────
// List conversations with filters: agentId, status, channel, search, range, page, limit.
// Only the last 8 days by default (range=all lifts it); agentCounts ignores the agentId filter.
// Bandeja (web-41, additive): view=all|needs|mine|closed and order=needs (needs first);
// every row also carries needsAttention and waitingSince.
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        agentId,
        status,
        channel,
        search,
        range,
        order,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string>;

      const rawView = req.query['view'];
      const view = parseInboxView(rawView);
      if (rawView !== undefined && !view) {
        throw new AppError(400, 'view must be one of: all, needs, mine, closed', 'VALIDATION_ERROR');
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const rawOutcome = req.query['outcome'];
      const outcome = rawOutcome === undefined || rawOutcome === '' ? null : parseOutcome(rawOutcome);
      if (rawOutcome !== undefined && rawOutcome !== '' && !outcome) {
        throw new AppError(400, 'outcome must be one of: sold, resolved, no_response, spam', 'VALIDATION_ERROR');
      }
      const timezone = (await getOrgTimezone(req.org!.id)) ?? 'UTC';

      const filter = buildInboxConditions({
        orgId: req.org!.id,
        userId: req.user!.userId,
        view,
        status,
        channel,
        search,
        range,
        agentId,
        outcome,
        timezone,
      });
      const where = filter.conditions.join(' AND ');
      // Everything but the agent filter, so the per-agent tabs keep their counts when one is selected
      const countsWhere = filter.baseConditions.join(' AND ');
      const params = filter.params;
      const paramIndex = params.length + 1;

      const [countResult, agentCountsResult] = await Promise.all([
        query<{ count: string }>(
          `SELECT COUNT(*) as count
           ${INBOX_FROM}
           WHERE ${where}`,
          params
        ),
        query<{ agent_id: string; agent_name: string | null; count: string }>(
          `SELECT c.agent_id, a.name as agent_name, COUNT(*) as count
           ${INBOX_FROM}
           WHERE ${countsWhere}
           GROUP BY c.agent_id, a.name`,
          filter.baseParams
        ),
      ]);
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      // Fetch conversations with contact and last message
      const rows = await query<{
        id: string;
        agent_id: string;
        agent_name: string;
        contact_id: string | null;
        contact_name: string | null;
        contact_phone: string | null;
        contact_email: string | null;
        contact_avatar: string | null;
        channel: string;
        status: string;
        taken_over_by: string | null;
        takeover_user_name: string | null;
        ai_score: number | null;
        captured_variables: Record<string, unknown>;
        last_message_at: string | null;
        message_count: number;
        created_at: string;
        last_message_content: string | null;
        last_message_role: string | null;
        last_message_sent_by_name: string | null;
        last_message_sent_by_id: string | null;
        handed_off_at: string | null;
        handoff_active: boolean;
        needs_attention: boolean;
        waiting_since: string | null;
        snoozed_until: string | null;
        snoozed_by: string | null;
        follow_up_at: string | null;
        follow_up_pending: boolean;
        closed_outcome: string | null;
        closed_at: string | null;
        closed_by: string | null;
        closed_by_name: string | null;
      }>(
        `SELECT
           c.id, c.agent_id, a.name as agent_name,
           c.contact_id,
           co.name as contact_name, co.phone as contact_phone, co.email as contact_email, co.avatar_url as contact_avatar,
           c.channel, c.status, c.taken_over_by,
           u.name as takeover_user_name,
           c.ai_score, c.captured_variables, c.last_message_at, c.message_count, c.created_at,
           lm.content as last_message_content, lm.role as last_message_role,
           lm.metadata->'sentBy'->>'name' as last_message_sent_by_name,
           lm.metadata->'sentBy'->>'id' as last_message_sent_by_id,
           c.handed_off_at,
           ${HANDOFF_ACTIVE_SQL} AS handoff_active,
           ${NEEDS_SQL} AS needs_attention,
           ${WAITING_SINCE_SQL} AS waiting_since,
           c.snoozed_until, c.snoozed_by, c.follow_up_at,
           ${followUpPendingSql(`$${paramIndex + 2}`)} AS follow_up_pending,
           c.closed_outcome, c.closed_at, c.closed_by, cb.name AS closed_by_name
         ${INBOX_FROM}
         LEFT JOIN users u ON c.taken_over_by = u.id
         LEFT JOIN users cb ON c.closed_by = cb.id
         LEFT JOIN LATERAL (
           SELECT content, role, metadata FROM messages
           WHERE conversation_id = c.id
           ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         WHERE ${where}
         ORDER BY ${inboxOrderBy(view, order, followUpPendingSql(`$${paramIndex + 2}`))}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limitNum, offset, timezone]
      );

      res.json({
        conversations: rows.rows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          agentName: row.agent_name,
          contact: row.contact_id
            ? {
                id: row.contact_id,
                name: row.contact_name,
                phone: row.contact_phone,
                email: row.contact_email,
                avatarUrl: row.contact_avatar,
              }
            : null,
          channel: row.channel,
          status: row.status,
          takenOverBy: row.taken_over_by,
          takeoverUserName: row.takeover_user_name,
          aiScore: row.ai_score,
          capturedVariables: row.captured_variables ?? {},
          lastMessageAt: row.last_message_at,
          messageCount: row.message_count,
          createdAt: row.created_at,
          handedOffAt: row.handed_off_at,
          handoffActive: row.handoff_active,
          needsAttention: row.needs_attention,
          waitingSince: row.waiting_since,
          snoozedUntil: row.snoozed_until,
          snoozedBy: row.snoozed_by,
          followUpAt: row.follow_up_at,
          followUpPending: row.follow_up_pending,
          closedOutcome: row.closed_outcome,
          closedAt: row.closed_at,
          closedBy: row.closed_by,
          closedByName: row.closed_by_name,
          lastMessage: row.last_message_content
            ? {
                content: row.last_message_content.slice(0, 100),
                role: row.last_message_role,
                sentByName: row.last_message_sent_by_name,
                sentById: row.last_message_sent_by_id,
              }
            : null,
        })),
        agentCounts: agentCountsResult.rows.map((row) => ({
          agentId: row.agent_id,
          agentName: row.agent_name ?? '',
          count: parseInt(row.count, 10),
        })),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/conversations/counts ───────────────────────────────────────────
// Counters for the Bandeja rail (web-41). Registered before /:id.
router.get(
  '/counts',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const range = typeof req.query['range'] === 'string' ? req.query['range'] : undefined;
      const totals = buildCountsQuery(req.org!.id, req.user!.userId, range, await getOrgTimezone(req.org!.id));
      const byAgent = buildCountsGroupQuery(req.org!.id, range, 'agent');
      const byChannel = buildCountsGroupQuery(req.org!.id, range, 'channel');
      type GroupRow = { key: string; name: string | null; count: string };
      const [t, a, ch] = await Promise.all([
        query<{ all_count: string; needs_count: string; mine_count: string; closed_count: string }>(totals.sql, totals.params),
        query<GroupRow>(byAgent.sql, byAgent.params),
        query<GroupRow>(byChannel.sql, byChannel.params),
      ]);
      const row = t.rows[0];
      res.json({
        all: parseInt(row?.all_count ?? '0', 10),
        needs: parseInt(row?.needs_count ?? '0', 10),
        mine: parseInt(row?.mine_count ?? '0', 10),
        closed: parseInt(row?.closed_count ?? '0', 10),
        byAgent: a.rows.map((r) => ({ agentId: r.key, agentName: r.name ?? '', count: parseInt(r.count, 10) })),
        byChannel: ch.rows.map((r) => ({ channel: r.key, count: parseInt(r.count, 10) })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/conversations/:id ───────────────────────────────────────────────
router.get(
  '/:id',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);

      const convResult = await query<{
        id: string;
        agent_id: string;
        agent_name: string;
        organization_id: string;
        contact_id: string | null;
        contact_name: string | null;
        contact_phone: string | null;
        contact_email: string | null;
        contact_avatar: string | null;
        contact_ai_score: number | null;
        contact_funnel_stage: string | null;
        contact_custom_variables: Record<string, unknown>;
        contact_ai_service: string | null;
        channel: string;
        status: string;
        taken_over_by: string | null;
        takeover_user_name: string | null;
        taken_over_at: string | null;
        ai_score: number | null;
        ai_summary: string | null;
        captured_variables: Record<string, unknown>;
        channel_metadata: Record<string, unknown>;
        last_message_at: string | null;
        message_count: number;
        created_at: string;
        updated_at: string;
        handed_off_at: string | null;
        handoff_active: boolean;
        needs_attention: boolean;
        waiting_since: string | null;
        last_customer_message_at: string | null;
        snoozed_until: string | null;
        snoozed_by: string | null;
        snoozed_by_name: string | null;
        follow_up_at: string | null;
        closed_outcome: string | null;
        closed_at: string | null;
        closed_by: string | null;
        closed_by_name: string | null;
      }>(
        `SELECT
           c.id, c.agent_id, a.name as agent_name, c.organization_id,
           c.contact_id,
           co.name as contact_name, co.phone as contact_phone, co.email as contact_email,
           co.avatar_url as contact_avatar, co.ai_score as contact_ai_score,
           co.funnel_stage as contact_funnel_stage, co.custom_variables as contact_custom_variables,
           co.ai_service as contact_ai_service,
           c.channel, c.status, c.taken_over_by,
           u.name as takeover_user_name,
           c.taken_over_at, c.ai_score, c.ai_summary, c.captured_variables,
           c.channel_metadata, c.last_message_at, c.message_count, c.created_at, c.updated_at,
           c.handed_off_at,
           ${HANDOFF_ACTIVE_SQL} AS handoff_active,
           ${NEEDS_SQL} AS needs_attention,
           ${WAITING_SINCE_SQL} AS waiting_since,
           (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id AND role = 'user') AS last_customer_message_at,
           c.snoozed_until, c.snoozed_by, sb.name AS snoozed_by_name, c.follow_up_at,
           c.closed_outcome, c.closed_at, c.closed_by, cb.name AS closed_by_name
         ${INBOX_FROM}
         LEFT JOIN users u ON c.taken_over_by = u.id
         LEFT JOIN users sb ON c.snoozed_by = sb.id
         LEFT JOIN users cb ON c.closed_by = cb.id
         WHERE c.id = $1 AND c.organization_id = $2`,
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) {
        throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
      }

      // Fetch messages with cursor-based pagination
      const msgBefore = req.query['msgBefore'] as string | undefined;
      const msgLimit = Math.min(parseInt((req.query['msgLimit'] as string) ?? '50', 10), 100);

      const msgConditions = ['conversation_id = $1'];
      const msgParams: unknown[] = [conversationId];
      let msgParamIdx = 2;

      if (msgBefore) {
        msgConditions.push(`created_at < $${msgParamIdx++}`);
        msgParams.push(msgBefore);
      }

      // Fetch newest first for cursor pagination, then reverse for chronological order
      const messagesResult = await query<{
        id: string;
        role: string;
        content: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }>(
        `SELECT id, role, content, metadata, created_at
         FROM messages
         WHERE ${msgConditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${msgParamIdx}`,
        [...msgParams, msgLimit + 1]
      );

      const hasMore = messagesResult.rows.length > msgLimit;
      const messageRows = messagesResult.rows.slice(0, msgLimit).reverse();

      const msgCountResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
        [conversationId]
      );
      const totalMessages = parseInt(msgCountResult.rows[0]?.count ?? '0', 10);
      // Historial de eventos (web-42). Solo la Bandeja lo lee; el agente nunca.
      const events = await listEvents(conversationId, req.org!.id);

      res.json({
        conversation: {
          id: conv.id,
          agentId: conv.agent_id,
          agentName: conv.agent_name,
          organizationId: conv.organization_id,
          contact: conv.contact_id
            ? {
                id: conv.contact_id,
                name: conv.contact_name,
                phone: conv.contact_phone,
                email: conv.contact_email,
                avatarUrl: conv.contact_avatar,
                aiScore: conv.contact_ai_score,
                funnelStage: conv.contact_funnel_stage,
                customVariables: conv.contact_custom_variables ?? {},
                aiService: conv.contact_ai_service,
              }
            : null,
          channel: conv.channel,
          status: conv.status,
          takenOverBy: conv.taken_over_by,
          takeoverUserName: conv.takeover_user_name,
          takenOverAt: conv.taken_over_at,
          aiScore: conv.ai_score,
          aiSummary: conv.ai_summary,
          capturedVariables: conv.captured_variables ?? {},
          channelMetadata: conv.channel_metadata ?? {},
          lastMessageAt: conv.last_message_at,
          messageCount: conv.message_count,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          handedOffAt: conv.handed_off_at,
          handoffActive: conv.handoff_active,
          needsAttention: conv.needs_attention,
          waitingSince: conv.waiting_since,
          lastCustomerMessageAt: conv.last_customer_message_at,
          snoozedUntil: conv.snoozed_until,
          snoozedBy: conv.snoozed_by,
          snoozedByName: conv.snoozed_by_name,
          followUpAt: conv.follow_up_at,
          closedOutcome: conv.closed_outcome,
          closedAt: conv.closed_at,
          closedBy: conv.closed_by,
          closedByName: conv.closed_by_name,
        },
        events,
        messages: messageRows.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata ?? {},
          createdAt: m.created_at,
        })),
        pagination: {
          total: totalMessages,
          hasMore,
          oldestTimestamp: messageRows[0]?.created_at ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/message ─────────────────────────────────────
// Send a message as a human agent (only during takeover)
router.post(
  '/:id/message',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const { content, image, audio } = req.body as {
        content?: string;
        image?: { data: string; mimeType: string };
        audio?: { data: string; mimeType: string };
      };

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        taken_over_by: string | null;
        channel: string;
        agent_id: string;
      }>(
        'SELECT id, organization_id, status, taken_over_by, channel, agent_id FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      if (conv.status !== 'human_takeover') {
        throw new AppError(400, 'Conversation is not in takeover mode', 'NOT_IN_TAKEOVER');
      }

      if (conv.taken_over_by !== req.user!.userId) {
        throw new AppError(403, 'You are not the active agent for this conversation', 'FORBIDDEN');
      }

      // Plan gating for multimedia
      const orgPlan = req.org!.plan as PlanKey;
      const orgPlanLimits = PLAN_LIMITS[orgPlan];

      if (audio?.data && !orgPlanLimits.voiceMessages) {
        throw new AppError(403, 'Voice messages require Starter plan or higher', 'PLAN_LIMIT');
      }

      if (image?.data && !orgPlanLimits.imageVision) {
        throw new AppError(403, 'Image sending requires Pro plan or higher', 'PLAN_LIMIT');
      }

      let messageContent = content?.trim() || '';
      // Who on the team wrote it (web-41): the Bandeja shows the name next to the bubble
      const senderResult = await query<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [req.user!.userId]);
      const msgMetadata: Record<string, unknown> = {
        sentBy: { id: req.user!.userId, name: senderResult.rows[0]?.name ?? null },
      };

      // Handle audio: transcribe with Whisper
      if (audio?.data) {
        try {
          const { transcribeAudio } = await import('../services/whatsapp.service');
          const audioBuffer = Buffer.from(audio.data, 'base64');
          const transcription = await transcribeAudio(audioBuffer, audio.mimeType);
          messageContent = transcription;
          msgMetadata['isVoiceMessage'] = true;
        } catch (err) {
          console.error('[conversations] Audio transcription failed:', err);
          throw new AppError(400, 'Failed to transcribe audio', 'TRANSCRIPTION_FAILED');
        }
      }

      // Handle image: store in metadata
      if (image?.data) {
        msgMetadata['hasImages'] = true;
        msgMetadata['imageCount'] = 1;
        msgMetadata['images'] = [{
          mimeType: image.mimeType,
          data: image.data,
          hasCaption: !!messageContent,
        }];
      }

      if (!messageContent && !image?.data) {
        throw new AppError(400, 'Message content is required', 'MISSING_CONTENT');
      }

      if (!messageContent) {
        messageContent = '[Image]';
      }

      // Save message
      const msgResult = await query<{ id: string; created_at: string }>(
        `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
         VALUES ($1, 'human', $2, $3, NOW())
         RETURNING id, created_at`,
        [conversationId, messageContent, JSON.stringify(msgMetadata)]
      );

      const message = {
        id: msgResult.rows[0]!.id,
        role: 'human',
        content: messageContent,
        metadata: msgMetadata,
        createdAt: msgResult.rows[0]!.created_at,
      };

      // Update conversation
      await query(
        `UPDATE conversations SET last_message_at = NOW(), message_count = message_count + 1, updated_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      // Send via WhatsApp if channel is whatsapp (text only — image sending from takeover is post-MVP)
      if (conv.channel === 'whatsapp') {
        try {
          const agentResult = await query<{ whatsapp_config: Record<string, unknown> }>(
            'SELECT whatsapp_config FROM agents WHERE id = $1',
            [conv.agent_id]
          );
          const waConfig = agentResult.rows[0]?.whatsapp_config;

          if (waConfig?.['connected'] && waConfig?.['phone_number_id'] && waConfig?.['access_token_encrypted']) {
            const contactResult = await query<{ phone: string | null }>(
              'SELECT phone FROM contacts WHERE id = (SELECT contact_id FROM conversations WHERE id = $1)',
              [conversationId]
            );
            const phone = contactResult.rows[0]?.phone;

            if (phone) {
              const { sendTextMessage, decryptAccessToken } = await import('../services/whatsapp.service');
              const accessToken = decryptAccessToken(String(waConfig['access_token_encrypted']));
              await sendTextMessage(String(waConfig['phone_number_id']), accessToken, phone, messageContent);
            }
          }
        } catch (err) {
          console.error(`[conversations] WhatsApp send error:`, (err as Error).message);
          // Non-fatal — message is saved, just couldn't send via WhatsApp
        }
      }

      // Send via Messenger if channel is facebook (text only, same as WhatsApp)
      if (conv.channel === 'facebook') {
        try {
          const agentResult = await query<{ facebook_config: Record<string, unknown> | null }>(
            'SELECT facebook_config FROM agents WHERE id = $1',
            [conv.agent_id]
          );
          const fbConfig = agentResult.rows[0]?.facebook_config;

          if (fbConfig?.['connected'] && fbConfig?.['page_id'] && fbConfig?.['page_access_token_encrypted']) {
            const contactResult = await query<{ facebook_psid: string | null }>(
              'SELECT facebook_psid FROM contacts WHERE id = (SELECT contact_id FROM conversations WHERE id = $1)',
              [conversationId]
            );
            const psid = contactResult.rows[0]?.facebook_psid;

            if (psid) {
              const { sendTextMessage, resolveAccessToken } = await import('../services/messenger.service');
              await sendTextMessage(resolveAccessToken(fbConfig), psid, messageContent);
            }
          }
        } catch (err) {
          console.error(`[conversations] Messenger send error:`, (err as Error).message);
          // Non-fatal — message is saved, just couldn't send via Messenger
        }
      }

      // Send via Telegram if channel is telegram (text only, same as Messenger)
      if (conv.channel === 'telegram') {
        try {
          const agentResult = await query<{ telegram_config: Record<string, unknown> | null }>(
            'SELECT telegram_config FROM agents WHERE id = $1',
            [conv.agent_id]
          );
          const tgConfig = agentResult.rows[0]?.telegram_config;

          if (tgConfig?.['connected'] && tgConfig?.['bot_id'] && tgConfig?.['bot_token_encrypted']) {
            const contactResult = await query<{ telegram_chat_id: string | null }>(
              'SELECT telegram_chat_id FROM contacts WHERE id = (SELECT contact_id FROM conversations WHERE id = $1)',
              [conversationId]
            );
            const chatId = contactResult.rows[0]?.telegram_chat_id;

            if (chatId) {
              const { sendTelegramMessage, resolveBotToken } = await import('../services/telegram.service');
              await sendTelegramMessage(resolveBotToken(tgConfig), chatId, messageContent);
            }
          }
        } catch (err) {
          console.error(`[conversations] Telegram send error:`, (err as Error).message);
          // Non-fatal — message is saved, just couldn't send via Telegram
        }
      }

      // Send via Email if channel is email (continues the prospect's thread)
      if (conv.channel === 'email') {
        try {
          const { sendEmailToConversation } = await import('../services/email.service');
          await sendEmailToConversation(conversationId, conv.agent_id, messageContent);
        } catch (err) {
          console.error(`[conversations] Email send error:`, (err as Error).message);
          // Non-fatal — message is saved, just couldn't send via email
        }
      }

      // Send via Instagram if channel is instagram (text only, same as Messenger)
      if (conv.channel === 'instagram') {
        try {
          const agentResult = await query<{ instagram_config: Record<string, unknown> | null }>(
            'SELECT instagram_config FROM agents WHERE id = $1',
            [conv.agent_id]
          );
          const igConfig = agentResult.rows[0]?.instagram_config;

          if (igConfig?.['connected'] && igConfig?.['instagram_id'] && igConfig?.['page_access_token_encrypted']) {
            const contactResult = await query<{ instagram_psid: string | null }>(
              'SELECT instagram_psid FROM contacts WHERE id = (SELECT contact_id FROM conversations WHERE id = $1)',
              [conversationId]
            );
            const igsid = contactResult.rows[0]?.instagram_psid;

            if (igsid) {
              const { sendTextMessage, resolveAccessToken, resolveInstagramId } = await import('../services/instagram.service');
              await sendTextMessage(resolveAccessToken(igConfig), resolveInstagramId(igConfig), igsid, messageContent);
            }
          }
        } catch (err) {
          const { InstagramMessagingDisabledError } = await import('../services/instagram.service');
          if (err instanceof InstagramMessagingDisabledError) {
            console.warn(`[conversations] Instagram: cliente no activó "Permitir acceso a mensajes" — conv: ${conversationId}`);
          } else {
            console.error(`[conversations] Instagram send error:`, (err as Error).message);
          }
          // Non-fatal — message is saved, just couldn't send via Instagram
        }
      }

      // Emit WebSocket events
      try {
        const io = getIO();
        io.to(`org:${conv.organization_id}`).emit('message:new', {
          conversationId,
          messages: [message],
        });
        io.to(`conv:${conversationId}`).emit('message:new', {
          conversationId,
          messages: [message],
        });
        io.to(`org:${conv.organization_id}`).emit('conversation:update', {
          conversationId,
          lastMessage: messageContent.slice(0, 100),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // WebSocket not initialized in test
      }

      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/takeover ────────────────────────────────────
router.post(
  '/:id/takeover',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const plan = req.org!.plan as PlanKey;
      const planLimits = PLAN_LIMITS[plan];

      // Check plan supports human takeover
      if (!planLimits.humanTakeover) {
        throw new AppError(
          403,
          'Human takeover is not available on your plan. Upgrade to enable this feature.',
          'PLAN_LIMIT'
        );
      }

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        taken_over_by: string | null;
      }>(
        'SELECT id, organization_id, status, taken_over_by FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      if (conv.status === 'human_takeover') {
        throw new AppError(400, 'Conversation is already in takeover mode', 'ALREADY_TAKEN_OVER');
      }

      // Tomarla también la saca de "Pospuestas" (web-42)
      await query(
        `UPDATE conversations
         SET status = 'human_takeover', taken_over_by = $1, taken_over_at = NOW(), snoozed_until = NULL,
             handoff_attended_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [req.user!.userId, conversationId]
      );

      const takerResult = await query<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [req.user!.userId]);
      const takenEvent = await recordEventSafe({
        organizationId: conv.organization_id,
        conversationId,
        type: 'taken',
        actorUserId: req.user!.userId,
      });
      emitConversationChange(
        conv.organization_id,
        conversationId,
        { status: 'human_takeover', takenOverBy: req.user!.userId, takeoverUserName: takerResult.rows[0]?.name ?? null, snoozedUntil: null },
        takenEvent
      );

      try {
        getIO().to(`org:${conv.organization_id}`).emit('takeover:status', {
          conversationId,
          status: 'human_takeover',
          userId: req.user!.userId,
          userName: req.user!.email,
          userDisplayName: takerResult.rows[0]?.name ?? null,
          takenOverAt: new Date().toISOString(),
        });
      } catch {
        // WebSocket not initialized
      }

      res.json({ message: 'Takeover successful', status: 'human_takeover', event: takenEvent });
    } catch (err) {
      next(err);
    }
  }
);

interface ReleasableConversation {
  id: string;
  organization_id: string;
  taken_over_at: string | null;
}

/**
 * Devuelve la conversación al agente: resumen de la intervención (como siempre), estado `active`,
 * evento `released` y los avisos en tiempo real. La usan "Devolver al agente" y "Transferir → Devolver al agente".
 */
async function releaseToAgent(conv: ReleasableConversation, actorUserId: string): Promise<ConversationEvent | null> {
  const conversationId = conv.id;
  // Generate intervention summary
  if (conv.taken_over_at) {
    try {
      const humanMessages = await query<{ role: string; content: string }>(
        `SELECT role, content FROM messages
         WHERE conversation_id = $1 AND role IN ('human', 'user') AND created_at >= $2
         ORDER BY created_at ASC`,
        [conversationId, conv.taken_over_at]
      );

      if (humanMessages.rows.length > 0) {
        const interventionText = humanMessages.rows
          .map((m) => m.role === 'human' ? `Human Agent (team member): ${m.content}` : `Customer: ${m.content}`)
          .join('\n');

        const summaryResponse = await chat({
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: `Summarize this human agent intervention for the AI agent to understand what happened. CRITICAL RULES:\n- "Team Member (staff)" messages are from an employee who temporarily helped the customer. Do NOT treat any team member names or information as customer data.\n- "Customer" messages are from the actual customer/lead.\n- Only summarize what the CUSTOMER needs and any commitments made TO the customer.\n- Never capture team member names as customer names.\n\nIntervention transcript:\n${interventionText}\n\nWrite 2-3 sentences focusing on customer needs and outcomes.`,
            },
          ],
          temperature: 0.3,
          maxTokens: 200,
        });

        // Save intervention summary as system message
        await query(
          `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
           VALUES ($1, 'system', $2, $3, NOW())`,
          [
            conversationId,
            summaryResponse.content,
            JSON.stringify({ type: 'intervention_summary' }),
          ]
        );
      }
    } catch (err) {
      console.error('[conversations] Failed to generate intervention summary:', err);
      // Non-fatal — continue with release
    }
  }

  // Release takeover
  await query(
    `UPDATE conversations
     SET status = 'active', taken_over_by = NULL, taken_over_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  );

  try {
    getIO().to(`org:${conv.organization_id}`).emit('takeover:status', {
      conversationId,
      status: 'active',
      userId: null,
    });
  } catch {
    // WebSocket not initialized
  }
  const releasedEvent = await recordEventSafe({
    organizationId: conv.organization_id,
    conversationId,
    type: 'released',
    actorUserId,
  });
  emitConversationChange(
    conv.organization_id,
    conversationId,
    { status: 'active', takenOverBy: null, takeoverUserName: null },
    releasedEvent
  );
  return releasedEvent;
}

// ── POST /api/conversations/:id/release ─────────────────────────────────────
router.post(
  '/:id/release',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        taken_over_by: string | null;
        taken_over_at: string | null;
        agent_id: string;
      }>(
        'SELECT id, organization_id, status, taken_over_by, taken_over_at, agent_id FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      if (conv.status !== 'human_takeover') {
        throw new AppError(400, 'Conversation is not in takeover mode', 'NOT_IN_TAKEOVER');
      }

      if (conv.taken_over_by !== req.user!.userId) {
        throw new AppError(403, 'You did not take over this conversation', 'FORBIDDEN');
      }

      const releasedEvent = await releaseToAgent(conv, req.user!.userId);

      res.json({ message: 'Conversation released to AI', status: 'active', event: releasedEvent });
    } catch (err) {
      next(err);
    }
  }
);

// ── PUT /api/conversations/:id/close ────────────────────────────────────────
router.put(
  '/:id/close',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      // web-42: resultado opcional (sin él se cierra como siempre, "Cerrada" a secas)
      const rawOutcome = (req.body as { outcome?: unknown } | undefined)?.outcome;
      const outcome = rawOutcome === undefined || rawOutcome === null ? null : parseOutcome(rawOutcome);
      if (rawOutcome !== undefined && rawOutcome !== null && !outcome) {
        throw new AppError(400, 'outcome must be one of: sold, resolved, no_response, spam', 'VALIDATION_ERROR');
      }

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        agent_id: string;
      }>(
        'SELECT id, organization_id, status, agent_id FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      if (conv.status === 'closed') {
        throw new AppError(400, 'Conversation is already closed', 'ALREADY_CLOSED');
      }

      const closedResult = await query<{ closed_at: string }>(
        `UPDATE conversations
         SET status = 'closed', closed_outcome = $2, closed_at = NOW(), closed_by = $3,
             snoozed_until = NULL, follow_up_at = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING closed_at`,
        [conversationId, outcome, req.user!.userId]
      );
      const closedAt = closedResult.rows[0]?.closed_at ?? new Date().toISOString();
      const closedEvent = await recordEventSafe({
        organizationId: conv.organization_id,
        conversationId,
        type: 'closed',
        actorUserId: req.user!.userId,
        data: outcome ? { outcome } : {},
      });

      // Enqueue AI scoring job
      try {
        await scoringQueue.add('score-conversation', {
          conversationId,
          organizationId: conv.organization_id,
          trigger: 'conversation_close',
        });
      } catch (err) {
        console.error('[conversations] Failed to enqueue scoring job:', err);
        // Non-fatal
      }

      emitConversationChange(
        conv.organization_id,
        conversationId,
        {
          status: 'closed',
          closedOutcome: outcome,
          closedAt,
          closedBy: req.user!.userId,
          closedByName: closedEvent?.actorName ?? null,
          snoozedUntil: null,
          followUpAt: null,
        },
        closedEvent
      );

      res.json({ message: 'Conversation closed', outcome, closedAt, event: closedEvent });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/reopen (web-42) ─────────────────────────────
// Back to `active` (the agent carries on) and the closed_* fields are cleared.
router.post(
  '/:id/reopen',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const r = await query<{ id: string; organization_id: string }>(
        `UPDATE conversations
         SET status = 'active', taken_over_by = NULL, taken_over_at = NULL,
             closed_outcome = NULL, closed_at = NULL, closed_by = NULL, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND status = 'closed'
         RETURNING id, organization_id`,
        [conversationId, req.org!.id]
      );
      if (!r.rows[0]) {
        const exists = await query('SELECT 1 FROM conversations WHERE id = $1 AND organization_id = $2', [conversationId, req.org!.id]);
        if (!exists.rows[0]) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
        throw new AppError(400, 'Conversation is not closed', 'NOT_CLOSED');
      }
      const event = await recordEventSafe({
        organizationId: req.org!.id,
        conversationId,
        type: 'reopened',
        actorUserId: req.user!.userId,
      });
      emitConversationChange(
        req.org!.id,
        conversationId,
        { status: 'active', takenOverBy: null, takeoverUserName: null, closedOutcome: null, closedAt: null, closedBy: null, closedByName: null },
        event
      );
      res.json({ message: 'Conversation reopened', status: 'active', event });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/transfer (web-42) ───────────────────────────
// Body: { toUserId: string | null, note?: string (≤ 500) }. null = back to the agent.
// Allowed for whoever has it taken, or the org's owner/admin. The receiver must be a member
// of the organization, and the plan must allow taking conversations (Starter or higher).
// toUserId = the caller (owner/admin only): "Tomarla tú" on a conversation someone else has.
router.post(
  '/:id/transfer',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const body = (req.body ?? {}) as { toUserId?: unknown; note?: unknown };
      const me = req.user!.userId;
      const isManager = req.user!.role === 'owner' || req.user!.role === 'admin';

      if (body.toUserId !== null && typeof body.toUserId !== 'string') {
        throw new AppError(400, 'toUserId is required (a user id, or null to hand it back to the agent)', 'VALIDATION_ERROR');
      }
      const toUserId = body.toUserId;
      if (toUserId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(toUserId)) {
        throw new AppError(400, 'toUserId must be a UUID', 'VALIDATION_ERROR');
      }
      if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
        throw new AppError(400, 'note must be a string', 'VALIDATION_ERROR');
      }
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (note.length > TRANSFER_NOTE_MAX) {
        throw new AppError(400, `note must be at most ${TRANSFER_NOTE_MAX} characters`, 'VALIDATION_ERROR');
      }

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        taken_over_by: string | null;
        taken_over_at: string | null;
        contact_name: string | null;
      }>(
        `SELECT c.id, c.organization_id, c.status, c.taken_over_by, c.taken_over_at, co.name AS contact_name
         FROM conversations c LEFT JOIN contacts co ON co.id = c.contact_id
         WHERE c.id = $1 AND c.organization_id = $2`,
        [conversationId, req.org!.id]
      );
      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
      if (conv.status === 'closed') throw new AppError(400, 'Conversation is closed', 'ALREADY_CLOSED');

      const holder = conv.status === 'human_takeover' ? conv.taken_over_by : null;
      if (holder !== me && !isManager) {
        throw new AppError(403, 'Only whoever has the conversation, an owner or an admin can transfer it', 'FORBIDDEN');
      }

      // ── back to the agent
      if (toUserId === null) {
        if (conv.status !== 'human_takeover') {
          throw new AppError(400, 'Conversation is not in takeover mode', 'NOT_IN_TAKEOVER');
        }
        const releasedEvent = await releaseToAgent(conv, me);
        res.json({ message: 'Conversation released to AI', status: 'active', event: releasedEvent });
        return;
      }

      if (toUserId === holder) {
        throw new AppError(400, 'That person already has the conversation', 'SAME_USER');
      }
      if (toUserId === me && !isManager) {
        throw new AppError(400, 'You cannot transfer a conversation to yourself', 'SAME_USER');
      }

      const plan = req.org!.plan as PlanKey;
      if (!PLAN_LIMITS[plan]?.humanTakeover) {
        throw new AppError(403, 'Taking conversations requires the Starter plan or higher', 'PLAN_LIMIT');
      }
      const member = await query<{ name: string | null; language: string | null }>(
        `SELECT u.name, u.language FROM user_organizations uo JOIN users u ON u.id = uo.user_id
         WHERE uo.organization_id = $1 AND uo.user_id = $2`,
        [req.org!.id, toUserId]
      );
      const receiver = member.rows[0];
      if (!receiver) throw new AppError(400, 'That person is not on this team', 'NOT_A_MEMBER');

      // Keep taken_over_at when it was already taken: the release summary covers the whole intervention
      await query(
        `UPDATE conversations
         SET status = 'human_takeover', taken_over_by = $1, taken_over_at = COALESCE(taken_over_at, NOW()),
             snoozed_until = NULL, handoff_attended_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [toUserId, conversationId]
      );

      const takingItMyself = toUserId === me;
      const event = await recordEventSafe({
        organizationId: conv.organization_id,
        conversationId,
        type: takingItMyself ? 'taken' : 'transferred',
        actorUserId: me,
        targetUserId: takingItMyself ? null : toUserId,
        data: takingItMyself ? (holder ? { fromUserId: holder } : {}) : { ...(note ? { note } : {}), ...(holder ? { fromUserId: holder } : {}) },
      });

      try {
        getIO().to(`org:${conv.organization_id}`).emit('takeover:status', {
          conversationId,
          status: 'human_takeover',
          userId: toUserId,
          userDisplayName: receiver.name ?? null,
          takenOverAt: new Date().toISOString(),
        });
      } catch {
        // WebSocket not initialized
      }
      emitConversationChange(
        conv.organization_id,
        conversationId,
        { status: 'human_takeover', takenOverBy: toUserId, takeoverUserName: receiver.name ?? null, snoozedUntil: null },
        event
      );

      if (!takingItMyself) {
        const text = transferNotificationText(receiver.language ?? 'en', event?.actorName ?? null, conv.contact_name, note || null);
        await createNotification({
          userId: toUserId,
          organizationId: conv.organization_id,
          type: 'conversation_transferred',
          title: text.title,
          message: text.message,
          data: { conversationId, fromUserId: me },
          sendEmail: false,
        }).catch((err: unknown) => console.error('[conversations] Failed to notify transfer:', (err as Error).message));
      }

      res.json({ message: 'Conversation transferred', status: 'human_takeover', takenOverBy: toUserId, event });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/snooze (web-42) ─────────────────────────────
// Body: { until: ISO date }. The screen computes it (organization's timezone) from the four options.
router.post(
  '/:id/snooze',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const raw = (req.body as { until?: unknown } | undefined)?.until;
      const until = typeof raw === 'string' ? new Date(raw) : null;
      if (!until || Number.isNaN(until.getTime())) {
        throw new AppError(400, 'until must be an ISO date', 'VALIDATION_ERROR');
      }
      const now = Date.now();
      if (until.getTime() <= now + 30_000) throw new AppError(400, 'until must be in the future', 'VALIDATION_ERROR');
      if (until.getTime() > now + SNOOZE_MAX_DAYS * 86_400_000) {
        throw new AppError(400, `until must be within ${SNOOZE_MAX_DAYS} days`, 'VALIDATION_ERROR');
      }

      const r = await query<{ id: string; snoozed_until: string }>(
        `UPDATE conversations
         SET snoozed_until = $3, snoozed_by = $4, follow_up_at = NULL, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND status <> 'closed'
         RETURNING id, snoozed_until`,
        [conversationId, req.org!.id, until.toISOString(), req.user!.userId]
      );
      if (!r.rows[0]) {
        const exists = await query('SELECT 1 FROM conversations WHERE id = $1 AND organization_id = $2', [conversationId, req.org!.id]);
        if (!exists.rows[0]) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
        throw new AppError(400, 'Conversation is closed', 'ALREADY_CLOSED');
      }
      const snoozedUntil = r.rows[0].snoozed_until;
      const event = await recordEventSafe({
        organizationId: req.org!.id,
        conversationId,
        type: 'snoozed',
        actorUserId: req.user!.userId,
        data: { until: snoozedUntil },
      });
      emitConversationChange(
        req.org!.id,
        conversationId,
        { snoozedUntil, snoozedBy: req.user!.userId, snoozedByName: event?.actorName ?? null, followUpAt: null },
        event
      );
      res.json({ message: 'Conversation snoozed', snoozedUntil, event });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/conversations/:id/snooze (web-42) ───────────────────────────
router.delete(
  '/:id/snooze',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const r = await query<{ id: string }>(
        `UPDATE conversations SET snoozed_until = NULL, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND snoozed_until IS NOT NULL
         RETURNING id`,
        [conversationId, req.org!.id]
      );
      if (!r.rows[0]) {
        const exists = await query('SELECT 1 FROM conversations WHERE id = $1 AND organization_id = $2', [conversationId, req.org!.id]);
        if (!exists.rows[0]) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
        throw new AppError(400, 'Conversation is not snoozed', 'NOT_SNOOZED');
      }
      const event = await recordEventSafe({
        organizationId: req.org!.id,
        conversationId,
        type: 'unsnoozed',
        actorUserId: req.user!.userId,
        data: { reason: 'manual' },
      });
      emitConversationChange(req.org!.id, conversationId, { snoozedUntil: null }, event);
      res.json({ message: 'Snooze removed', event });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/conversations/bulk ──────────────────────────────────────────
// Must be registered before /:id to avoid Express matching "bulk" as a UUID
// web-42: borrar es solo para owner y admin
router.delete(
  '/bulk',
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { conversationIds } = req.body as { conversationIds: string[] };
      if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
        throw new AppError(400, 'conversationIds array is required', 'VALIDATION_ERROR');
      }
      if (conversationIds.length > 50) {
        throw new AppError(400, 'Maximum 50 conversations at a time', 'VALIDATION_ERROR');
      }

      // Fetch all valid conversations
      const placeholders = conversationIds.map((_, i) => `$${i + 2}`).join(', ');
      const convs = await query<{ id: string; contact_id: string | null }>(
        `SELECT id, contact_id FROM conversations WHERE id IN (${placeholders}) AND organization_id = $1`,
        [req.org!.id, ...conversationIds]
      );

      const validIds = convs.rows.map((r) => r.id);
      const contactIds = [...new Set(convs.rows.map((r) => r.contact_id).filter(Boolean))] as string[];

      if (validIds.length === 0) {
        res.json({ deleted: 0, contactsDeleted: 0 });
        return;
      }

      // Delete messages and conversations
      const idPlaceholders = validIds.map((_, i) => `$${i + 1}`).join(', ');
      await query(`DELETE FROM messages WHERE conversation_id IN (${idPlaceholders})`, validIds);
      await query(`DELETE FROM conversations WHERE id IN (${idPlaceholders})`, validIds);

      // Delete orphan contacts
      let contactsDeleted = 0;
      for (const contactId of contactIds) {
        const remaining = await query<{ count: string }>(
          'SELECT COUNT(*) as count FROM conversations WHERE contact_id = $1',
          [contactId]
        );
        if (parseInt(remaining.rows[0]?.count ?? '0', 10) === 0) {
          await query('DELETE FROM contacts WHERE id = $1', [contactId]);
          contactsDeleted++;
        }
      }

      res.json({ deleted: validIds.length, contactsDeleted });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/conversations/:id ────────────────────────────────────────────
router.delete(
  '/:id',
  validateUUID('id'),
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);

      const convResult = await query<{
        id: string;
        organization_id: string;
        contact_id: string | null;
      }>(
        'SELECT id, organization_id, contact_id FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      // Delete messages first (in case CASCADE isn't set)
      await query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
      // Delete the conversation
      await query('DELETE FROM conversations WHERE id = $1', [conversationId]);

      // Check if the contact has other conversations; if not, delete the orphan contact
      if (conv.contact_id) {
        const otherConvs = await query<{ count: string }>(
          'SELECT COUNT(*) as count FROM conversations WHERE contact_id = $1',
          [conv.contact_id]
        );
        if (parseInt(otherConvs.rows[0]?.count ?? '0', 10) === 0) {
          await query('DELETE FROM contacts WHERE id = $1', [conv.contact_id]);
        }
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations (create from widget/API) ────────────────────────
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { agentId, channel = 'web', channelMetadata = {} } = req.body as {
        agentId: string;
        channel?: string;
        channelMetadata?: Record<string, unknown>;
      };

      if (!agentId) {
        throw new AppError(400, 'agentId is required', 'MISSING_AGENT_ID');
      }

      // Verify agent belongs to org and is published
      const agentResult = await query<{ id: string; status: string }>(
        `SELECT id, status FROM agents WHERE id = $1 AND organization_id = $2`,
        [agentId, req.org!.id]
      );

      if (!agentResult.rows[0]) {
        throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
      }

      const result = await query<{ id: string; created_at: string }>(
        `INSERT INTO conversations (agent_id, organization_id, channel, status, channel_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', $4, NOW(), NOW())
         RETURNING id, created_at`,
        // Reserved keys (wa_from, ip_hash, human_verified_at) are written only by the server (services/channel-metadata-keys.ts).
        [agentId, req.org!.id, channel, JSON.stringify(withoutReservedChannelKeys(channelMetadata))]
      );

      res.status(201).json({
        conversation: {
          id: result.rows[0]!.id,
          agentId,
          channel,
          status: 'active',
          createdAt: result.rows[0]!.created_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
