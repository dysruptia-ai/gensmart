import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validateUUID } from '../middleware/validateUUID';
import { requireRole } from '../middleware/requireRole';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { INBOX_LIMITS, PLAN_LIMITS } from '@gensmart/shared';
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
  UNREAD_SQL,
  followUpPendingSql,
  inboxOrderBy,
  normalizeSearch,
  escapeLike,
  parseInboxOrder,
  parseInboxView,
} from '../services/inbox-query.service';
import { parseListFilters } from '../services/inbox-list-params';
import { getChannelIssues, observeSend } from '../services/channel-health.service';
import { findOwnView, mergeSavedView } from '../services/inbox-views.service';
import {
  SNOOZE_MAX_DAYS,
  TRANSFER_NOTE_MAX,
  emitConversationChange,
  getOrgTimezone,
  listEvents,
  parseOutcome,
  recordEventSafe,
} from '../services/conversation-events.service';
import { createNotification } from '../services/notification.service';
import {
  NotYoursError,
  getAiAccess,
  getAiSummary,
  getHandoffInfo,
  getSuggestions,
  publicAccess,
} from '../services/inbox-ai.service';
import {
  allLabelsOwned,
  applyLabelDelta,
  bulkAssignNotificationText,
  closeConversation,
  findReceiver,
  planAllowsTakeover,
  releaseToAgent,
  runBulk,
  setConversationLabels,
  transferConversation,
} from '../services/conversation-actions.service';
import { bulkAssignSchema, bulkCloseSchema, bulkDeleteSchema, bulkLabelsSchema, isUuid } from '../services/inbox-bulk.schemas';
import { markRead, markUnread } from '../services/inbox-reads.service';
import {
  CONVERSATION_LABELS_SQL,
  type LabelRef,
  createNote,
  emitInbox,
  getConversationLabels,
  isInboxAdmin,
  listNotes,
  noteBodySchema,
  rowToNote,
  setLabelsSchema,
} from '../services/inbox-annotations.service';

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
        status,
        range,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string>;
      const listFilters = parseListFilters(req.query);
      const search = normalizeSearch(req.query['search'], INBOX_LIMITS.searchMinChars);
      const rawOrder = req.query['order'];
      const order = parseInboxOrder(rawOrder) ?? undefined;
      if (rawOrder !== undefined && rawOrder !== '' && !order) {
        throw new AppError(400, 'order must be one of: needs, recent, unread', 'VALIDATION_ERROR');
      }

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

      const requested = {
        orgId: req.org!.id,
        userId: req.user!.userId,
        view,
        status,
        search,
        range,
        outcome,
        timezone,
        ...listFilters,
      };
      // web-44: una vista guardada (solo las propias; una ajena o borrada se ignora y queda la lista pedida)
      const savedViewId = typeof req.query['savedView'] === 'string' ? req.query['savedView'] : '';
      const savedFilters = savedViewId ? await findOwnView(req.org!.id, req.user!.userId, savedViewId) : null;
      const input = savedFilters ? mergeSavedView(requested, savedFilters) : requested;
      const filter = buildInboxConditions(input);
      const where = filter.conditions.join(' AND ');
      // Everything but the agent filter, so the per-agent tabs keep their counts when one is selected
      const countsWhere = filter.baseConditions.join(' AND ');
      const params = filter.params;
      const paramIndex = params.length + 1;
      // web-44: sin leer para quien pide la lista (mismo placeholder en el total y en las filas)
      const unreadCountSql = UNREAD_SQL(`$${params.length + 1}`);
      const unreadRowSql = UNREAD_SQL(`$${paramIndex + 3}`);
      const effectiveView = search ? null : (input.view ?? null);

      const [countResult, agentCountsResult] = await Promise.all([
        query<{ count: string; unread_count: string }>(
          `SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE ${unreadCountSql}) AS unread_count
           ${INBOX_FROM}
           WHERE ${where}`,
          [...params, req.user!.userId]
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
      const unreadCount = parseInt(countResult.rows[0]?.unread_count ?? '0', 10);

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
        labels: LabelRef[];
        unread: boolean;
        search_content: string | null;
        search_role: string | null;
        search_created_at: string | null;
        search_sent_by_name: string | null;
        search_sent_by_id: string | null;
      }>(
        `${search ? 'SELECT p.*, sm.content AS search_content, sm.role AS search_role, sm.created_at AS search_created_at, sm.sent_by_name AS search_sent_by_name, sm.sent_by_id AS search_sent_by_id FROM (' : ''}SELECT
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
           c.closed_outcome, c.closed_at, c.closed_by, cb.name AS closed_by_name,
           ${CONVERSATION_LABELS_SQL} AS labels,
           ${unreadRowSql} AS unread
         ${INBOX_FROM}
         LEFT JOIN users u ON c.taken_over_by = u.id
         LEFT JOIN users cb ON c.closed_by = cb.id
         LEFT JOIN LATERAL (
           SELECT content, role, metadata FROM messages
           WHERE conversation_id = c.id
           ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         WHERE ${where}
         ORDER BY ${inboxOrderBy(effectiveView, order, followUpPendingSql(`$${paramIndex + 2}`), unreadRowSql, !!search)}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}${
           // Búsqueda: el mensaje más reciente que coincide, solo para las filas ya limitadas de la página
           search
             ? `) p
         LEFT JOIN LATERAL (
           SELECT left(m.content, 2000) AS content, m.role, m.created_at,
                  m.metadata->'sentBy'->>'name' AS sent_by_name, m.metadata->'sentBy'->>'id' AS sent_by_id
           FROM messages m
           WHERE m.conversation_id = p.id AND m.role IN ('user', 'assistant', 'human')
             AND gs_search_norm(m.content) LIKE gs_search_norm($${paramIndex + 4}) ESCAPE '\\'
           ORDER BY m.created_at DESC LIMIT 1
         ) sm ON true
         ORDER BY p.last_message_at DESC NULLS LAST, p.id`
             : ''
         }`,
        [...params, limitNum, offset, timezone, req.user!.userId, ...(search ? [`%${escapeLike(search)}%`] : [])]
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
          labels: row.labels ?? [],
          unread: row.unread,
          searchMatch:
            search && row.search_content !== null
              ? {
                  content: row.search_content,
                  role: row.search_role,
                  createdAt: row.search_created_at,
                  sentByName: row.search_sent_by_name,
                  sentById: row.search_sent_by_id,
                }
              : null,
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
        unreadCount,
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
      type GroupRow = { key: string; name: string | null; count: string; paused_at: string | null };
      const [t, a, ch, channelIssues] = await Promise.all([
        query<{
          all_count: string;
          needs_count: string;
          mine_count: string;
          closed_count: string;
          oldest_waiting_since: string | null;
        }>(totals.sql, totals.params),
        query<GroupRow>(byAgent.sql, byAgent.params),
        query<GroupRow>(byChannel.sql, byChannel.params),
        getChannelIssues(req.org!.id),
      ]);
      const row = t.rows[0];
      res.json({
        all: parseInt(row?.all_count ?? '0', 10),
        needs: parseInt(row?.needs_count ?? '0', 10),
        mine: parseInt(row?.mine_count ?? '0', 10),
        closed: parseInt(row?.closed_count ?? '0', 10),
        byAgent: a.rows.map((r) => ({
          agentId: r.key,
          agentName: r.name ?? '',
          count: parseInt(r.count, 10),
          inboxPausedAt: r.paused_at,
        })),
        byChannel: ch.rows.map((r) => ({ channel: r.key, count: parseInt(r.count, 10) })),
        // web-45: la meta de respuesta (la más antigua de "Necesitan") y los avisos de canal
        oldestWaitingSince: row?.oldest_waiting_since ? new Date(row.oldest_waiting_since).toISOString() : null,
        channelIssues,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/conversations/agent-stats?agentId= (web-45) ────────────────────
// Los números del día de un agente, en la zona horaria de la organización. Registrada antes de /:id.
router.get(
  '/agent-stats',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = typeof req.query['agentId'] === 'string' ? req.query['agentId'] : '';
      if (!isUuid(agentId)) throw new AppError(400, 'agentId is required', 'VALIDATION_ERROR');
      const tz = (await getOrgTimezone(req.org!.id)) ?? 'UTC';
      const r = await query<{ today: string; solved_alone: string; asked_help: string }>(
        `WITH day AS (
           SELECT (date_trunc('day', NOW() AT TIME ZONE $3) AT TIME ZONE $3) AS start
         )
         SELECT
           (SELECT COUNT(DISTINCT c.id) FROM conversations c JOIN messages m ON m.conversation_id = c.id, day
             WHERE c.organization_id = $1 AND c.agent_id = $2 AND m.created_at >= day.start AND m.role <> 'system') AS today,
           (SELECT COUNT(*) FROM conversations c, day
             WHERE c.organization_id = $1 AND c.agent_id = $2 AND c.status = 'closed' AND c.closed_at >= day.start
               AND NOT EXISTS (SELECT 1 FROM conversation_events e
                                WHERE e.conversation_id = c.id AND e.type IN ('taken', 'transferred', 'assigned'))) AS solved_alone,
           (SELECT COUNT(*) FROM conversation_events e JOIN conversations c ON c.id = e.conversation_id, day
             WHERE c.organization_id = $1 AND c.agent_id = $2 AND e.type = 'handoff_requested' AND e.created_at >= day.start) AS asked_help`,
        [req.org!.id, agentId, tz]
      );
      const row = r.rows[0];
      res.json({
        agentId,
        today: parseInt(row?.today ?? '0', 10),
        solvedAlone: parseInt(row?.solved_alone ?? '0', 10),
        askedHelp: parseInt(row?.asked_help ?? '0', 10),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── Acciones en lote (web-44) ───────────────────────────────────────────────
// Registradas antes de /:id. Cada conversación sigue las reglas de su acción individual (las mismas
// funciones de conversation-actions.service); las que no cumplen se saltan con su motivo.
// Respuesta: { updated: string[], skipped: Array<{ id, reason }> }.

// POST /api/conversations/bulk/assign  { ids, toUserId, note? }
router.post(
  '/bulk/assign',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids, toUserId, note } = bulkAssignSchema.parse(req.body);
      if (!planAllowsTakeover(req.org!.plan)) {
        throw new AppError(403, 'Taking conversations requires the Starter plan or higher', 'PLAN_LIMIT');
      }
      const receiver = await findReceiver(req.org!.id, toUserId);
      if (!receiver) throw new AppError(400, 'That person is not on this team', 'NOT_A_MEMBER');
      const me = req.user!.userId;
      let actorName: string | null = null;
      const result = await runBulk(ids, async (id) => {
        if (!isUuid(id)) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
        const r = await transferConversation({
          organizationId: req.org!.id,
          plan: req.org!.plan,
          actor: { userId: me, role: req.user!.role },
          conversationId: id,
          toUserId,
          note,
          receiver,
          notify: false,
        });
        actorName = actorName ?? r.event?.actorName ?? null;
      });
      // Una sola notificación para quien recibe, aunque sean varias (mismo tipo que transferir)
      if (result.updated.length > 0 && toUserId !== me) {
        if (!actorName) {
          const u = await query<{ name: string | null }>('SELECT name FROM users WHERE id = $1', [me]);
          actorName = u.rows[0]?.name ?? null;
        }
        const text = bulkAssignNotificationText(receiver.language ?? 'en', actorName, result.updated.length, note || null);
        await createNotification({
          userId: toUserId,
          organizationId: req.org!.id,
          type: 'conversation_transferred',
          title: text.title,
          message: text.message,
          data: {
            ...(result.updated.length === 1 ? { conversationId: result.updated[0] } : {}),
            conversationIds: result.updated,
            count: result.updated.length,
            fromUserId: me,
          },
          sendEmail: false,
        }).catch((err: unknown) => console.error('[conversations] Failed to notify bulk assign:', (err as Error).message));
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/conversations/bulk/close  { ids, outcome }  (el resultado es obligatorio)
router.post(
  '/bulk/close',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids, outcome } = bulkCloseSchema.parse(req.body);
      const result = await runBulk(ids, async (id) => {
        if (!isUuid(id)) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
        await closeConversation({ organizationId: req.org!.id, actorUserId: req.user!.userId, conversationId: id, outcome });
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/conversations/bulk/labels  { ids, add, remove }  (no reemplaza las que no se tocaron)
router.post(
  '/bulk/labels',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids, add, remove } = bulkLabelsSchema.parse(req.body);
      if (!(await allLabelsOwned(req.org!.id, [...new Set([...add, ...remove])]))) {
        throw new AppError(400, 'Unknown label', 'UNKNOWN_LABEL');
      }
      const result = await runBulk(ids, async (id) => {
        if (!isUuid(id)) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
        const current = await query<{ label_id: string }>(
          'SELECT label_id FROM conversation_labels WHERE conversation_id = $1 AND organization_id = $2',
          [id, req.org!.id]
        );
        const labelIds = applyLabelDelta(
          current.rows.map((r) => r.label_id),
          add,
          remove
        );
        await setConversationLabels({
          organizationId: req.org!.id,
          actorUserId: req.user!.userId,
          conversationId: id,
          labelIds,
          ownershipChecked: true,
        });
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/read y /:id/unread (web-44) ─────────────────
// Leído por persona: cualquier rol, idempotente, sin evento. Solo se emite a esa persona.
router.post(
  '/:id/read',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ok = await markRead(req.org!.id, req.user!.userId, String(req.params['id']));
      if (!ok) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
      res.json({ unread: false });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/unread',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ok = await markUnread(req.org!.id, req.user!.userId, String(req.params['id']));
      if (!ok) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
      res.json({ unread: true });
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
      // Notas internas y etiquetas (web-43). Las notas solo las lee la Bandeja.
      const [notes, labels, handoff, aiAccess] = await Promise.all([
        listNotes(conversationId, req.org!.id, req.user!.userId, req.user!.role),
        getConversationLabels(conversationId),
        // web-46: causa y resumen del pedido de ayuda, y si la IA de la Bandeja está disponible
        getHandoffInfo(conversationId, req.org!.id),
        getAiAccess(req.org!.id),
      ]);
      const aiSummary = handoff ? await getAiSummary(conversationId, handoff.eventId) : null;

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
          labels,
        },
        events,
        notes,
        handoff,
        aiSummary,
        ai: publicAccess(aiAccess),
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
              observeSend(conv.agent_id, 'whatsapp', null);
            }
          }
        } catch (err) {
          observeSend(conv.agent_id, 'whatsapp', err);
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
              observeSend(conv.agent_id, 'facebook', null);
            }
          }
        } catch (err) {
          observeSend(conv.agent_id, 'facebook', err);
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
              observeSend(conv.agent_id, 'telegram', null);
            }
          }
        } catch (err) {
          observeSend(conv.agent_id, 'telegram', err);
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
              observeSend(conv.agent_id, 'instagram', null);
            }
          }
        } catch (err) {
          const { InstagramMessagingDisabledError } = await import('../services/instagram.service');
          if (err instanceof InstagramMessagingDisabledError) {
            console.warn(`[conversations] Instagram: cliente no activó "Permitir acceso a mensajes" — conv: ${conversationId}`);
          } else {
            observeSend(conv.agent_id, 'instagram', err);
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

      const { closedAt, event: closedEvent } = await closeConversation({
        organizationId: req.org!.id,
        actorUserId: req.user!.userId,
        conversationId,
        outcome,
      });

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

      const result = await transferConversation({
        organizationId: req.org!.id,
        plan: req.org!.plan,
        actor: { userId: me, role: req.user!.role },
        conversationId,
        toUserId,
        note,
      });
      if (toUserId === null) {
        res.json({ message: 'Conversation released to AI', status: 'active', event: result.event });
        return;
      }
      res.json({ message: 'Conversation transferred', status: 'human_takeover', takenOverBy: toUserId, event: result.event });
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

// ── POST /api/conversations/:id/notes (web-43) ──────────────────────────────
// ── POST /api/conversations/:id/suggestions (web-46) ────────────────────────
// Tres respuestas para el último mensaje del cliente. Solo quien la tiene tomada. Una generación por
// mensaje del cliente (la segunda petición devuelve la guardada sin cobrar). No se emiten al equipo.
router.post(
  '/:id/suggestions',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await getSuggestions(String(req.params['id']), req.org!.id, req.user!.userId);
      res.json(result);
    } catch (err) {
      if (err instanceof NotYoursError) {
        next(new AppError(403, 'Only the person handling this conversation can get suggestions', 'NOT_YOURS'));
        return;
      }
      next(err);
    }
  }
);

// Nota interna: cualquier rol, plan y estado (incluso cerrada o fuera de la ventana de 24 h), porque no
// sale por el canal. No toca la conversación: ni last_message_at, ni message_count, ni la espera.
router.post(
  '/:id/notes',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const { body } = noteBodySchema.parse(req.body);
      const exists = await query('SELECT 1 FROM conversations WHERE id = $1 AND organization_id = $2', [conversationId, req.org!.id]);
      if (!exists.rows[0]) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
      const row = await createNote({ organizationId: req.org!.id, conversationId, authorUserId: req.user!.userId, body });
      const note = rowToNote(row, req.user!.userId, req.user!.role);
      // Para el resto del equipo, canDelete depende de cada quien: la web lo recalcula al recibirla
      emitInbox(req.org!.id, 'conversation:note', { conversationId, note }, conversationId);
      res.status(201).json({ note });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/conversations/:id/notes/:noteId (web-43) ────────────────────
// El autor o un owner/admin. Borrado lógico + evento note_deleted sin el texto.
router.delete(
  '/:id/notes/:noteId',
  validateUUID('id'),
  validateUUID('noteId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const noteId = String(req.params['noteId']);
      const found = await query<{ author_user_id: string | null }>(
        `SELECT author_user_id FROM conversation_notes
         WHERE id = $1 AND conversation_id = $2 AND organization_id = $3 AND deleted_at IS NULL`,
        [noteId, conversationId, req.org!.id]
      );
      const note = found.rows[0];
      if (!note) throw new AppError(404, 'Note not found', 'NOT_FOUND');
      if (note.author_user_id !== req.user!.userId && !isInboxAdmin(req.user!.role)) {
        throw new AppError(403, 'Only the author or an admin can delete this note', 'FORBIDDEN');
      }
      const r = await query(
        `UPDATE conversation_notes SET deleted_at = NOW(), deleted_by = $2
         WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [noteId, req.user!.userId]
      );
      if (!r.rows[0]) throw new AppError(404, 'Note not found', 'NOT_FOUND');
      const event = await recordEventSafe({
        organizationId: req.org!.id,
        conversationId,
        type: 'note_deleted',
        actorUserId: req.user!.userId,
        data: { noteId },
      });
      emitInbox(req.org!.id, 'conversation:note-deleted', { conversationId, noteId, event }, conversationId);
      res.json({ noteId, event });
    } catch (err) {
      next(err);
    }
  }
);

// ── PUT /api/conversations/:id/labels (web-43) ──────────────────────────────
// Deja exactamente esas etiquetas. Cualquier rol, solo etiquetas de la organización.
router.put(
  '/:id/labels',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const labelIds = [...new Set(setLabelsSchema.parse(req.body).labelIds)];
      const { labels } = await setConversationLabels({
        organizationId: req.org!.id,
        actorUserId: req.user!.userId,
        conversationId,
        labelIds,
      });
      res.json({ labels });
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
      // web-44: mismo tope y mensajes que las demás acciones en lote; un id que no es UUID no existe
      const conversationIds = bulkDeleteSchema.parse(req.body).conversationIds.filter(isUuid);
      if (conversationIds.length === 0) {
        res.json({ deleted: 0, contactsDeleted: 0 });
        return;
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
