/**
 * Historial de eventos de una conversación (web-42) y lo que se hace con ella además de responder:
 * posponer (y que vuelva sola), transferir y cerrar con resultado.
 *
 * Los eventos viven en `conversation_events`, nunca en `messages`: el worker del agente arma su
 * historial solo con `messages`, así que el modelo no los ve.
 */
import { query } from '../config/database';
import { getIO } from '../config/websocket';
import { createNotification } from './notification.service';

export type ConversationEventType =
  | 'handoff_requested'
  | 'taken'
  | 'released'
  | 'transferred'
  | 'snoozed'
  | 'unsnoozed'
  | 'closed'
  | 'reopened'
  | 'note_deleted'
  | 'assigned';

export const CLOSE_OUTCOMES = ['sold', 'resolved', 'no_response', 'spam'] as const;
export type CloseOutcome = (typeof CLOSE_OUTCOMES)[number];

export function parseOutcome(value: unknown): CloseOutcome | null {
  return typeof value === 'string' && (CLOSE_OUTCOMES as readonly string[]).includes(value) ? (value as CloseOutcome) : null;
}

export const TRANSFER_NOTE_MAX = 500;
/** Lo más lejos que se puede posponer. */
export const SNOOZE_MAX_DAYS = 60;

export interface ConversationEvent {
  id: string;
  type: ConversationEventType;
  actorUserId: string | null;
  actorName: string | null;
  targetUserId: string | null;
  targetName: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

interface EventRow {
  id: string;
  type: ConversationEventType;
  actor_user_id: string | null;
  actor_name: string | null;
  target_user_id: string | null;
  target_name: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

function rowToEvent(row: EventRow): ConversationEvent {
  return {
    id: row.id,
    type: row.type,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    targetUserId: row.target_user_id,
    targetName: row.target_name,
    data: row.data ?? {},
    createdAt: row.created_at,
  };
}

export interface RecordEventInput {
  organizationId: string;
  conversationId: string;
  type: ConversationEventType;
  actorUserId?: string | null;
  targetUserId?: string | null;
  data?: Record<string, unknown>;
}

/** Guarda un evento y lo devuelve con los nombres de las personas (para emitirlo tal cual). */
export async function recordEvent(input: RecordEventInput): Promise<ConversationEvent> {
  const result = await query<EventRow>(
    `WITH e AS (
       INSERT INTO conversation_events (organization_id, conversation_id, type, actor_user_id, target_user_id, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *
     )
     SELECT e.id, e.type, e.actor_user_id, au.name AS actor_name, e.target_user_id, tu.name AS target_name,
            e.data, e.created_at
     FROM e
     LEFT JOIN users au ON au.id = e.actor_user_id
     LEFT JOIN users tu ON tu.id = e.target_user_id`,
    [
      input.organizationId,
      input.conversationId,
      input.type,
      input.actorUserId ?? null,
      input.targetUserId ?? null,
      JSON.stringify(input.data ?? {}),
    ]
  );
  return rowToEvent(result.rows[0]!);
}

/** Igual que recordEvent, pero un fallo no tumba la acción que ya se hizo (se registra en el log). */
export async function recordEventSafe(input: RecordEventInput): Promise<ConversationEvent | null> {
  try {
    return await recordEvent(input);
  } catch (err) {
    console.error(`[conversation-events] Failed to record ${input.type}:`, (err as Error).message);
    return null;
  }
}

export async function listEvents(conversationId: string, organizationId: string): Promise<ConversationEvent[]> {
  const result = await query<EventRow>(
    `SELECT e.id, e.type, e.actor_user_id, au.name AS actor_name, e.target_user_id, tu.name AS target_name,
            e.data, e.created_at
     FROM conversation_events e
     LEFT JOIN users au ON au.id = e.actor_user_id
     LEFT JOIN users tu ON tu.id = e.target_user_id
     WHERE e.conversation_id = $1 AND e.organization_id = $2
     ORDER BY e.created_at ASC, e.id ASC`,
    [conversationId, organizationId]
  );
  return result.rows.map(rowToEvent);
}

/**
 * `conversation:update` para la Bandeja de todo el equipo. Lleva los campos que cambiaron y, si hay,
 * el evento nuevo para pintarlo en el hilo sin recargar.
 */
export function emitConversationChange(
  organizationId: string,
  conversationId: string,
  fields: Record<string, unknown>,
  event?: ConversationEvent | null
): void {
  try {
    getIO()
      .to(`org:${organizationId}`)
      .emit('conversation:update', {
        conversationId,
        ...fields,
        ...(event ? { event } : {}),
        updatedAt: new Date().toISOString(),
      });
  } catch {
    // WebSocket not initialized (tests)
  }
}

// ── pedido de ayuda ──────────────────────────────────────────────────────────

/**
 * Marca un pedido de ayuda (web-45): `handed_off_at`, el evento `handoff_requested` y el reparto
 * automático. Lo usan el traspaso del agente (human-handoff, paso 8) y el agente pausado (worker).
 * Un fallo del reparto no deshace el pedido.
 */
export async function markHandoffRequested(
  conversationId: string,
  opts: { organizationId: string; reason?: string }
): Promise<ConversationEvent | null> {
  const r = await query<{ handed_off_at: string }>(
    'UPDATE conversations SET handed_off_at = NOW() WHERE id = $1 AND organization_id = $2 RETURNING handed_off_at',
    [conversationId, opts.organizationId]
  );
  if (!r.rows[0]) return null;
  const event = await recordEventSafe({
    organizationId: opts.organizationId,
    conversationId,
    type: 'handoff_requested',
    data: opts.reason ? { reason: opts.reason } : {},
  });
  emitConversationChange(opts.organizationId, conversationId, { handedOffAt: r.rows[0].handed_off_at, handoffActive: true }, event);
  const { autoAssignSafe } = await import('./inbox-assignment.service');
  await autoAssignSafe(conversationId);
  return event;
}

// ── zona horaria de la organización ─────────────────────────────────────────

/** La zona de Ajustes si es una zona IANA válida; si no, null (la pantalla usa la del navegador). */
export function validTimezone(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

export async function getOrgTimezone(organizationId: string): Promise<string | null> {
  const r = await query<{ tz: string | null }>(`SELECT settings->>'timezone' AS tz FROM organizations WHERE id = $1`, [
    organizationId,
  ]);
  return validTimezone(r.rows[0]?.tz);
}

// ── posponer: vuelve antes si el cliente escribe, o con el cron ─────────────

/**
 * Lo llama pushToBuffer con cada mensaje del cliente (todos los canales pasan por ahí).
 * Una sola UPDATE que no hace nada si la conversación no estaba pospuesta.
 */
export async function unsnoozeOnCustomerMessage(conversationId: string): Promise<void> {
  try {
    const r = await query<{ organization_id: string; follow_up_at: string }>(
      `UPDATE conversations
       SET snoozed_until = NULL, follow_up_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND snoozed_until IS NOT NULL
       RETURNING organization_id, follow_up_at`,
      [conversationId]
    );
    const row = r.rows[0];
    if (!row) return;
    const event = await recordEventSafe({
      organizationId: row.organization_id,
      conversationId,
      type: 'unsnoozed',
      data: { reason: 'customer_message' },
    });
    emitConversationChange(row.organization_id, conversationId, { snoozedUntil: null, followUpAt: row.follow_up_at }, event);
  } catch (err) {
    console.error('[conversation-events] unsnoozeOnCustomerMessage failed:', (err as Error).message);
  }
}

function snoozeReturnText(language: string, contactName: string | null): { title: string; message: string } {
  const who = contactName?.trim();
  if (language === 'es') {
    return {
      title: 'Volvió una conversación pospuesta',
      message: who ? `La conversación con ${who} volvió a tu lista.` : 'Una conversación que pospusiste volvió a tu lista.',
    };
  }
  return {
    title: 'A snoozed conversation is back',
    message: who ? `Your conversation with ${who} is back in your list.` : 'A conversation you snoozed is back in your list.',
  };
}

/**
 * El cron de cada minuto: quita la posposición a las que vencieron, marca follow_up_at, registra el
 * evento, avisa a la Bandeja y notifica (sin correo) a quien la pospuso. La UPDATE … RETURNING es
 * atómica: si hay dos instancias de la API, cada conversación la devuelve solo una.
 */
/**
 * `onlyIds` es solo para los tests: limita el cron a sus propias filas. El cron real lo llama sin argumentos.
 */
export async function releaseDueSnoozes(onlyIds?: readonly string[]): Promise<number> {
  const due = await query<{
    id: string;
    organization_id: string;
    snoozed_by: string | null;
    follow_up_at: string;
    contact_name: string | null;
    language: string | null;
  }>(
    `WITH due AS (
       UPDATE conversations
       SET snoozed_until = NULL, follow_up_at = NOW(), updated_at = NOW()
       WHERE snoozed_until IS NOT NULL AND snoozed_until <= NOW() AND status <> 'closed'
         AND ($1::uuid[] IS NULL OR id = ANY($1::uuid[]))
       RETURNING id, organization_id, snoozed_by, follow_up_at, contact_id
     )
     SELECT due.id, due.organization_id, due.snoozed_by, due.follow_up_at, co.name AS contact_name, u.language
     FROM due
     LEFT JOIN contacts co ON co.id = due.contact_id
     LEFT JOIN users u ON u.id = due.snoozed_by`,
    [onlyIds ? [...onlyIds] : null]
  );
  for (const row of due.rows) {
    const event = await recordEventSafe({
      organizationId: row.organization_id,
      conversationId: row.id,
      type: 'unsnoozed',
      data: { reason: 'timer' },
    });
    emitConversationChange(row.organization_id, row.id, { snoozedUntil: null, followUpAt: row.follow_up_at }, event);
    if (row.snoozed_by) {
      const text = snoozeReturnText(row.language ?? 'en', row.contact_name);
      await createNotification({
        userId: row.snoozed_by,
        organizationId: row.organization_id,
        type: 'conversation_snooze_ended',
        title: text.title,
        message: text.message,
        data: { conversationId: row.id },
        sendEmail: false,
      }).catch((err: unknown) => console.error('[snooze-cron] Failed to notify:', (err as Error).message));
    }
  }
  return due.rows.length;
}

export function transferNotificationText(
  language: string,
  fromName: string | null,
  contactName: string | null,
  note: string | null
): { title: string; message: string } {
  const from = fromName?.trim() || (language === 'es' ? 'Alguien del equipo' : 'A teammate');
  const who = contactName?.trim();
  if (language === 'es') {
    return {
      title: `${from} te transfirió una conversación`,
      message: note || (who ? `Ahora atiendes la conversación con ${who}.` : 'Ahora atiendes esta conversación.'),
    };
  }
  return {
    title: `${from} transferred a conversation to you`,
    message: note || (who ? `You're now handling the conversation with ${who}.` : "You're now handling this conversation."),
  };
}
