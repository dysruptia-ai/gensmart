/**
 * Filtros de la Bandeja (web-41) para GET /api/conversations y GET /api/conversations/counts.
 *
 * Las expresiones suponen este FROM (ver INBOX_FROM):
 *   conversations c, agents a, contacts co y el lateral `lr` (último mensaje que no es del sistema).
 *
 * "Necesitan a alguien" (needs):
 *   - el agente pidió ayuda (traspaso vigente) y nadie tomó la conversación, o
 *   - una persona la tomó y el último mensaje es del cliente (sin responder).
 * Los mensajes `system` (resumen de la intervención) no cuentan como respuesta ni como mensaje del cliente.
 */

export type InboxView = 'all' | 'needs' | 'mine' | 'closed';

export const INBOX_VIEWS: readonly InboxView[] = ['all', 'needs', 'mine', 'closed'];

export function parseInboxView(value: unknown): InboxView | null {
  return typeof value === 'string' && (INBOX_VIEWS as readonly string[]).includes(value) ? (value as InboxView) : null;
}

/** Traspaso vigente: la misma regla que ya devolvía la API como `handoffActive`. */
export const HANDOFF_ACTIVE_SQL = `(c.handed_off_at IS NOT NULL
  AND c.handed_off_at > NOW() - make_interval(hours => COALESCE(NULLIF(a.handoff_config->>'labelTtlHours', '')::int, 24)))`;

const ASKED_FOR_HELP_SQL = `(${HANDOFF_ACTIVE_SQL} AND c.taken_over_by IS NULL AND c.status <> 'closed')`;
const TAKEN_UNANSWERED_SQL = `(c.status = 'human_takeover' AND lr.role = 'user')`;

export const NEEDS_SQL = `(${ASKED_FOR_HELP_SQL} OR ${TAKEN_UNANSWERED_SQL})`;

/** Desde cuándo espera: la hora del traspaso o la del último mensaje del cliente; NULL si no espera. */
export const WAITING_SINCE_SQL = `(CASE
  WHEN ${ASKED_FOR_HELP_SQL} THEN c.handed_off_at
  WHEN ${TAKEN_UNANSWERED_SQL} THEN lr.created_at
  ELSE NULL END)`;

export const INBOX_FROM = `FROM conversations c
  LEFT JOIN agents a ON c.agent_id = a.id
  LEFT JOIN contacts co ON c.contact_id = co.id
  LEFT JOIN LATERAL (
    SELECT role, created_at FROM messages
    WHERE conversation_id = c.id AND role <> 'system'
    ORDER BY created_at DESC LIMIT 1
  ) lr ON true`;

export const RECENT_SQL = `COALESCE(c.last_message_at, c.created_at) >= NOW() - interval '8 days'`;

export interface InboxFilterInput {
  orgId: string;
  userId: string;
  view?: InboxView | null;
  status?: string;
  channel?: string;
  search?: string;
  range?: string;
  agentId?: string;
}

export interface SqlFilter {
  /** Condiciones sin el filtro de agente (para los contadores por agente de la lista). */
  baseConditions: string[];
  baseParams: unknown[];
  conditions: string[];
  params: unknown[];
}

/**
 * Condiciones parametrizadas de la lista. Sin `view` son exactamente las de antes.
 * - `view=needs` y `view=mine` son colas de trabajo: no las recorta el período.
 * - `view=all` son las abiertas (no cerradas); `view=closed` = `status=closed`.
 */
export function buildInboxConditions(input: InboxFilterInput): SqlFilter {
  const conditions: string[] = ['c.organization_id = $1'];
  const params: unknown[] = [input.orgId];
  const next = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  const view = input.view ?? null;
  if (view === 'needs') conditions.push(NEEDS_SQL);
  if (view === 'mine') conditions.push(`c.taken_over_by = ${next(input.userId)}`, `c.status <> 'closed'`);
  if (view === 'all') conditions.push(`c.status <> 'closed'`);
  if (view === 'closed') conditions.push(`c.status = 'closed'`);

  if (input.status) conditions.push(`c.status = ${next(input.status)}`);
  if (input.channel) conditions.push(`c.channel = ${next(input.channel)}`);
  if (input.search) {
    const p = next(`%${input.search}%`);
    conditions.push(`(co.name ILIKE ${p} OR co.phone ILIKE ${p} OR co.email ILIKE ${p})`);
  }
  const queue = view === 'needs' || view === 'mine';
  if (input.range !== 'all' && !queue) conditions.push(RECENT_SQL);

  const baseConditions = [...conditions];
  const baseParams = [...params];
  if (input.agentId) conditions.push(`c.agent_id = ${next(input.agentId)}`);

  return { baseConditions, baseParams, conditions, params };
}

/** Orden de la lista: por defecto el de siempre; en "Necesitan a alguien", la que más espera primero. */
export function inboxOrderBy(view: InboxView | null, order: string | undefined): string {
  if (view === 'needs') return `${WAITING_SINCE_SQL} ASC NULLS LAST, c.last_message_at DESC NULLS LAST`;
  if (order === 'needs') return `${NEEDS_SQL} DESC, c.last_message_at DESC NULLS LAST`;
  return 'c.last_message_at DESC NULLS LAST';
}

/**
 * Contadores del riel de la Bandeja. `all`, `closed`, `byAgent` y `byChannel` respetan el período;
 * `needs` y `mine` no (son colas de trabajo, como en la lista). byAgent y byChannel cuentan las abiertas.
 */
export function buildCountsQuery(orgId: string, userId: string, range: string | undefined): { sql: string; params: unknown[] } {
  const recent = range === 'all' ? 'TRUE' : RECENT_SQL;
  const sql = `SELECT
      COUNT(*) FILTER (WHERE c.status <> 'closed' AND ${recent}) AS all_count,
      COUNT(*) FILTER (WHERE ${NEEDS_SQL}) AS needs_count,
      COUNT(*) FILTER (WHERE c.taken_over_by = $2 AND c.status <> 'closed') AS mine_count,
      COUNT(*) FILTER (WHERE c.status = 'closed' AND ${recent}) AS closed_count
    ${INBOX_FROM}
    WHERE c.organization_id = $1`;
  return { sql, params: [orgId, userId] };
}

export function buildCountsGroupQuery(
  orgId: string,
  range: string | undefined,
  by: 'agent' | 'channel',
): { sql: string; params: unknown[] } {
  const recent = range === 'all' ? '' : ` AND ${RECENT_SQL}`;
  const sql =
    by === 'agent'
      ? `SELECT c.agent_id AS key, a.name AS name, COUNT(*) AS count
         FROM conversations c LEFT JOIN agents a ON c.agent_id = a.id
         WHERE c.organization_id = $1 AND c.status <> 'closed'${recent}
         GROUP BY c.agent_id, a.name ORDER BY a.name NULLS LAST`
      : `SELECT c.channel AS key, NULL AS name, COUNT(*) AS count
         FROM conversations c
         WHERE c.organization_id = $1 AND c.status <> 'closed'${recent}
         GROUP BY c.channel ORDER BY COUNT(*) DESC`;
  return { sql, params: [orgId] };
}
