/**
 * Bandeja (web-44): lo que se hace con una conversación, en un solo lugar para la ruta individual y
 * para el lote. Cada función valida las reglas, cambia la conversación, deja su evento y emite su
 * `conversation:update`, igual que antes en la ruta. Si algo no se cumple lanza AppError con el mismo
 * status y código que respondía la ruta, y el lote convierte ese código en el motivo del salto.
 */
import { INBOX_LIMITS, PLAN_LIMITS } from '@gensmart/shared';
import { query } from '../config/database';
import { getIO } from '../config/websocket';
import { scoringQueue } from '../config/queues';
import { AppError } from '../middleware/errorHandler';
import { chat } from './llm.service';
import { createNotification } from './notification.service';
import {
  type CloseOutcome,
  type ConversationEvent,
  emitConversationChange,
  recordEventSafe,
  transferNotificationText,
} from './conversation-events.service';
import { type LabelRef, getConversationLabels } from './inbox-annotations.service';

export interface Actor {
  userId: string;
  role: string | undefined;
}

export function isManager(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function planAllowsTakeover(plan: string): boolean {
  return !!PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.humanTakeover;
}

// ── devolver al agente ──────────────────────────────────────────────────────

export interface ReleasableConversation {
  id: string;
  organization_id: string;
  taken_over_at: string | null;
}

/**
 * Devuelve la conversación al agente: resumen de la intervención (como siempre), estado `active`,
 * evento `released` y los avisos en tiempo real. La usan "Devolver al agente" y "Transferir → Devolver al agente".
 */
export async function releaseToAgent(conv: ReleasableConversation, actorUserId: string): Promise<ConversationEvent | null> {
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

// ── transferir / asignar ────────────────────────────────────────────────────

export interface Receiver {
  id: string;
  name: string | null;
  language: string | null;
}

/** La persona que recibe tiene que ser de la organización. */
export async function findReceiver(organizationId: string, userId: string): Promise<Receiver | null> {
  const member = await query<{ name: string | null; language: string | null }>(
    `SELECT u.name, u.language FROM user_organizations uo JOIN users u ON u.id = uo.user_id
     WHERE uo.organization_id = $1 AND uo.user_id = $2`,
    [organizationId, userId]
  );
  const row = member.rows[0];
  return row ? { id: userId, name: row.name, language: row.language } : null;
}

export interface TransferInput {
  organizationId: string;
  plan: string;
  actor: Actor;
  conversationId: string;
  /** null = devolver al agente. */
  toUserId: string | null;
  note: string;
  /** Ya resuelta (el lote la busca una sola vez). */
  receiver?: Receiver | null;
  /** false en el lote: allí se manda una sola notificación al final. */
  notify?: boolean;
}

export interface TransferResult {
  status: 'active' | 'human_takeover';
  takenOverBy: string | null;
  event: ConversationEvent | null;
  contactName: string | null;
  /** true si la recibió otra persona (no "Tomarla tú" ni devolver al agente). */
  transferred: boolean;
}

/**
 * Las reglas de transferir (web-42): quien la tiene o un owner/admin; un miembro no puede pasársela
 * a sí mismo; con persona, plan Starter o superior y que la persona sea de la organización.
 */
export async function transferConversation(input: TransferInput): Promise<TransferResult> {
  const { organizationId, actor, conversationId, toUserId, note } = input;
  const me = actor.userId;
  const manager = isManager(actor.role);

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
    [conversationId, organizationId]
  );
  const conv = convResult.rows[0];
  if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
  if (conv.status === 'closed') throw new AppError(400, 'Conversation is closed', 'ALREADY_CLOSED');

  const holder = conv.status === 'human_takeover' ? conv.taken_over_by : null;
  if (holder !== me && !manager) {
    throw new AppError(403, 'Only whoever has the conversation, an owner or an admin can transfer it', 'FORBIDDEN');
  }

  // ── back to the agent
  if (toUserId === null) {
    if (conv.status !== 'human_takeover') {
      throw new AppError(400, 'Conversation is not in takeover mode', 'NOT_IN_TAKEOVER');
    }
    const event = await releaseToAgent(conv, me);
    return { status: 'active', takenOverBy: null, event, contactName: conv.contact_name, transferred: false };
  }

  if (toUserId === holder) {
    throw new AppError(400, 'That person already has the conversation', 'SAME_USER');
  }
  if (toUserId === me && !manager) {
    throw new AppError(400, 'You cannot transfer a conversation to yourself', 'SAME_USER');
  }
  if (!planAllowsTakeover(input.plan)) {
    throw new AppError(403, 'Taking conversations requires the Starter plan or higher', 'PLAN_LIMIT');
  }
  const receiver = input.receiver !== undefined ? input.receiver : await findReceiver(organizationId, toUserId);
  if (!receiver) throw new AppError(400, 'That person is not on this team', 'NOT_A_MEMBER');

  // Keep taken_over_at when it was already taken: the release summary covers the whole intervention.
  // The WHERE keeps it atomic: if it was closed meanwhile, nothing changes.
  const updated = await query(
    `UPDATE conversations
     SET status = 'human_takeover', taken_over_by = $1, taken_over_at = COALESCE(taken_over_at, NOW()),
         snoozed_until = NULL, handoff_attended_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND status <> 'closed'`,
    [toUserId, conversationId]
  );
  if ((updated.rowCount ?? 0) === 0) throw new AppError(400, 'Conversation is closed', 'ALREADY_CLOSED');

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

  if (!takingItMyself && input.notify !== false) {
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

  return { status: 'human_takeover', takenOverBy: toUserId, event, contactName: conv.contact_name, transferred: !takingItMyself };
}

/** La notificación de "Asignar N": una sola, aunque sean varias. */
export function bulkAssignNotificationText(
  language: string,
  fromName: string | null,
  count: number,
  note: string | null
): { title: string; message: string } {
  const from = fromName?.trim() || (language === 'es' ? 'Alguien del equipo' : 'A teammate');
  if (language === 'es') {
    return {
      title: count === 1 ? `${from} te asignó 1 conversación` : `${from} te asignó ${count} conversaciones`,
      message: note || (count === 1 ? 'Ahora la atiendes tú.' : 'Ahora las atiendes tú.'),
    };
  }
  return {
    title: count === 1 ? `${from} assigned you 1 conversation` : `${from} assigned you ${count} conversations`,
    message: note || (count === 1 ? "You're now handling it." : "You're now handling them."),
  };
}

// ── cerrar ───────────────────────────────────────────────────────────────────

export interface CloseResult {
  outcome: CloseOutcome | null;
  closedAt: string;
  event: ConversationEvent | null;
}

/** Cierra con resultado (opcional en la ruta individual): evento `closed`, scoring y emisión. */
export async function closeConversation(input: {
  organizationId: string;
  actorUserId: string;
  conversationId: string;
  outcome: CloseOutcome | null;
}): Promise<CloseResult> {
  const { organizationId, actorUserId, conversationId, outcome } = input;
  const closedResult = await query<{ closed_at: string; organization_id: string }>(
    `UPDATE conversations
     SET status = 'closed', closed_outcome = $3, closed_at = NOW(), closed_by = $4,
         snoozed_until = NULL, follow_up_at = NULL, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND status <> 'closed'
     RETURNING closed_at, organization_id`,
    [conversationId, organizationId, outcome, actorUserId]
  );
  if (!closedResult.rows[0]) {
    const exists = await query('SELECT 1 FROM conversations WHERE id = $1 AND organization_id = $2', [conversationId, organizationId]);
    if (!exists.rows[0]) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
    throw new AppError(400, 'Conversation is already closed', 'ALREADY_CLOSED');
  }
  const closedAt = closedResult.rows[0].closed_at;
  const closedEvent = await recordEventSafe({
    organizationId,
    conversationId,
    type: 'closed',
    actorUserId,
    data: outcome ? { outcome } : {},
  });

  // Enqueue AI scoring job
  try {
    await scoringQueue.add('score-conversation', {
      conversationId,
      organizationId,
      trigger: 'conversation_close',
    });
  } catch (err) {
    console.error('[conversations] Failed to enqueue scoring job:', err);
    // Non-fatal
  }

  emitConversationChange(
    organizationId,
    conversationId,
    {
      status: 'closed',
      closedOutcome: outcome,
      closedAt,
      closedBy: actorUserId,
      closedByName: closedEvent?.actorName ?? null,
      snoozedUntil: null,
      followUpAt: null,
    },
    closedEvent
  );
  return { outcome, closedAt, event: closedEvent };
}

// ── etiquetas ────────────────────────────────────────────────────────────────

/** Cuántos de esos ids son etiquetas de la organización (para responder 400 a una ajena). */
export async function allLabelsOwned(organizationId: string, labelIds: readonly string[]): Promise<boolean> {
  if (labelIds.length === 0) return true;
  const own = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM inbox_labels WHERE id = ANY($1::uuid[]) AND organization_id = $2',
    [[...labelIds], organizationId]
  );
  return parseInt(own.rows[0]?.count ?? '0', 10) === labelIds.length;
}

/**
 * Deja exactamente esas etiquetas (web-43). `ownershipChecked` = el llamador ya comprobó que son de la
 * organización. Solo emite `conversation:update` si algo cambió.
 */
export async function setConversationLabels(input: {
  organizationId: string;
  actorUserId: string;
  conversationId: string;
  labelIds: readonly string[];
  ownershipChecked?: boolean;
}): Promise<{ labels: LabelRef[]; changed: boolean }> {
  const { organizationId, actorUserId, conversationId } = input;
  const labelIds = [...new Set(input.labelIds)];
  if (labelIds.length > INBOX_LIMITS.labelsPerConversation) {
    throw new AppError(422, `At most ${INBOX_LIMITS.labelsPerConversation} labels per conversation`, 'conversation_labels_limit');
  }
  const exists = await query('SELECT 1 FROM conversations WHERE id = $1 AND organization_id = $2', [conversationId, organizationId]);
  if (!exists.rows[0]) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
  if (!input.ownershipChecked && !(await allLabelsOwned(organizationId, labelIds))) {
    throw new AppError(400, 'Unknown label', 'UNKNOWN_LABEL');
  }
  const removed = await query(
    'DELETE FROM conversation_labels WHERE conversation_id = $1 AND NOT (label_id = ANY($2::uuid[])) RETURNING label_id',
    [conversationId, labelIds]
  );
  const added = await query(
    `INSERT INTO conversation_labels (conversation_id, label_id, organization_id, added_by)
     SELECT $1, unnest($2::uuid[]), $3, $4
     ON CONFLICT (conversation_id, label_id) DO NOTHING
     RETURNING label_id`,
    [conversationId, labelIds, organizationId, actorUserId]
  );
  const labels = await getConversationLabels(conversationId);
  const changed = (removed.rowCount ?? 0) > 0 || (added.rowCount ?? 0) > 0;
  if (changed) emitConversationChange(organizationId, conversationId, { labels });
  return { labels, changed };
}

/** El conjunto que queda al aplicar `add` y `remove` (lo que no se tocó se conserva). */
export function applyLabelDelta(current: readonly string[], add: readonly string[], remove: readonly string[]): string[] {
  const removeSet = new Set(remove);
  const out = current.filter((id) => !removeSet.has(id));
  for (const id of add) if (!removeSet.has(id) && !out.includes(id)) out.push(id);
  return out;
}

// ── lote ─────────────────────────────────────────────────────────────────────

export type SkipReason =
  | 'not_found'
  | 'already_closed'
  | 'forbidden'
  | 'same_user'
  | 'not_in_takeover'
  | 'label_limit'
  | 'error';

/** El código de AppError de la acción individual → el motivo del salto en el lote. */
export function skipReasonFor(err: unknown): SkipReason {
  const code = err instanceof AppError ? err.code : undefined;
  switch (code) {
    case 'NOT_FOUND':
      return 'not_found';
    case 'ALREADY_CLOSED':
      return 'already_closed';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'SAME_USER':
      return 'same_user';
    case 'NOT_IN_TAKEOVER':
      return 'not_in_takeover';
    case 'conversation_labels_limit':
      return 'label_limit';
    default:
      return 'error';
  }
}

export interface BulkResult {
  updated: string[];
  skipped: Array<{ id: string; reason: SkipReason }>;
}

/**
 * Corre la acción en cada conversación, una por una (sin transacción común): que una falle no deshace
 * las demás. Cada cambio es una sola UPDATE atómica, como en la ruta individual.
 */
export async function runBulk(ids: readonly string[], each: (id: string) => Promise<void>): Promise<BulkResult> {
  const result: BulkResult = { updated: [], skipped: [] };
  for (const id of ids) {
    try {
      await each(id);
      result.updated.push(id);
    } catch (err) {
      const reason = skipReasonFor(err);
      if (reason === 'error') console.error('[conversations bulk] unexpected error:', (err as Error).message);
      result.skipped.push({ id, reason });
    }
  }
  return result;
}
