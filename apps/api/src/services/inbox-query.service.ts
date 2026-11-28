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
 *
 * Posponer (web-42): mientras `snoozed_until` tiene valor la conversación no está en "Todas" ni en
 * "Necesitan a alguien"; está en "Mías" (grupo "Pospuestas"). Al volver queda `follow_up_at`.
 */

export type InboxView = 'all' | 'needs' | 'mine' | 'closed';

export const INBOX_VIEWS: readonly InboxView[] = ['all', 'needs', 'mine', 'closed'];

export function parseInboxView(value: unknown): InboxView | null {
  return typeof value === 'string' && (INBOX_VIEWS as readonly string[]).includes(value) ? (value as InboxView) : null;
}

/**
 * Pedido de ayuda vigente (la API lo devuelve como `handoffActive`): dentro del TTL del traspaso y sin
 * atender. Queda atendido cuando alguien toma la conversación o la recibe por transferencia después del
 * pedido (`handoff_attended_at`); solo vuelve a contar con un `handed_off_at` nuevo (web-42b).
 */
export const HANDOFF_ACTIVE_SQL = `(c.handed_off_at IS NOT NULL
  AND c.handed_off_at > NOW() - make_interval(hours => COALESCE(NULLIF(a.handoff_config->>'labelTtlHours', '')::int, 24))
  AND (c.handoff_attended_at IS NULL OR c.handoff_attended_at < c.handed_off_at))`;

const ASKED_FOR_HELP_SQL = `(${HANDOFF_ACTIVE_SQL} AND c.taken_over_by IS NULL AND c.status <> 'closed')`;
const TAKEN_UNANSWERED_SQL = `(c.status = 'human_takeover' AND lr.role = 'user')`;

/** Pospuesta ahora mismo. */
export const NOT_SNOOZED_SQL = `c.snoozed_until IS NULL`;

export const NEEDS_SQL = `((${ASKED_FOR_HELP_SQL} OR ${TAKEN_UNANSWERED_SQL}) AND ${NOT_SNOOZED_SQL})`;

/**
 * "Seguimiento para hoy": volvió de posponer hoy (en la zona `tz` de la organización) y nadie
 * (persona o agente) respondió después de que volvió. `tz` es un placeholder ($n) con una zona IANA.
 */
export function followUpPendingSql(tz: string): string {
  return `(c.follow_up_at IS NOT NULL
    AND (c.follow_up_at AT TIME ZONE ${tz})::date = (NOW() AT TIME ZONE ${tz})::date
    AND NOT EXISTS (
      SELECT 1 FROM messages fm
      WHERE fm.conversation_id = c.id AND fm.role IN ('human', 'assistant') AND fm.created_at > c.follow_up_at
    ))`;
}

/**
 * "Mías": las que tengo tomadas, más las que pospuse sin que nadie las tuviera tomadas
 * (mientras siguen pospuestas o en seguimiento para hoy).
 */
export function mineSql(user: string, tz: string): string {
  return `(c.status <> 'closed' AND (c.taken_over_by = ${user}
    OR (c.taken_over_by IS NULL AND c.snoozed_by = ${user} AND (c.snoozed_until IS NOT NULL OR ${followUpPendingSql(tz)}))))`;
}

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

/** Los roles de `messages` que la búsqueda lee: nunca `system` (y las notas viven en otra tabla). */
export const SEARCHABLE_ROLES_SQL = `('user', 'assistant', 'human')`;

/**
 * Sin leer para una persona (web-44). `user` es un placeholder ($n) con su id.
 * - hay un mensaje del cliente posterior a GREATEST(su última lectura, su inbox_read_since), o
 * - la marcó como no leída (marked_unread_at) y no la volvió a abrir.
 * Los mensajes del agente, del equipo y del sistema no la vuelven no leída, ni las notas.
 * Sin fila en user_organizations (sesión de una cuenta madre) el punto de partida es la creación del usuario.
 */
export function UNREAD_SQL(user: string): string {
  return `(EXISTS (
      SELECT 1 FROM conversation_reads rr
      WHERE rr.conversation_id = c.id AND rr.user_id = ${user} AND rr.marked_unread_at IS NOT NULL)
    OR EXISTS (
      SELECT 1 FROM messages um
      WHERE um.conversation_id = c.id AND um.role = 'user'
        AND um.created_at > GREATEST(
          COALESCE((SELECT rr.last_read_at FROM conversation_reads rr WHERE rr.conversation_id = c.id AND rr.user_id = ${user}), '-infinity'::timestamptz),
          COALESCE(
            (SELECT uo.inbox_read_since FROM user_organizations uo WHERE uo.user_id = ${user} AND uo.organization_id = c.organization_id),
            (SELECT u.created_at FROM users u WHERE u.id = ${user}),
            '-infinity'::timestamptz))))`;
}

/** "Solo el agente": abierta con el agente, sin pedido de ayuda vigente y sin posponer. */
export const AGENT_ONLY_SQL = `(c.status = 'active' AND NOT ${HANDOFF_ACTIVE_SQL} AND ${NOT_SNOOZED_SQL})`;

export type InboxOrder = 'needs' | 'recent' | 'unread';

export function parseInboxOrder(value: unknown): InboxOrder | null {
  return value === 'needs' || value === 'recent' || value === 'unread' ? value : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escapa %, _ y \ para LIKE … ESCAPE '\\' (el texto se busca literal). */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** El texto de búsqueda recortado, o null si es más corto que el mínimo (entonces no hay búsqueda). */
export function normalizeSearch(value: unknown, minChars: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return [...text].length >= minChars ? text : null;
}

export interface InboxFilterInput {
  orgId: string;
  userId: string;
  view?: InboxView | null;
  status?: string;
  /** Compatibilidad: un solo canal (se suma a `channels`). */
  channel?: string;
  channels?: readonly string[];
  /** Ya recortado y con el largo mínimo (normalizeSearch). Con búsqueda se ignoran la vista y el periodo. */
  search?: string | null;
  range?: string;
  /** Compatibilidad: un solo agente (se suma a `agentIds`). */
  agentId?: string;
  agentIds?: readonly string[];
  labelIds?: readonly string[];
  /** Otra lista de etiquetas que también debe cumplirse (AND): los filtros del panel sobre una vista guardada. */
  extraLabelIds?: readonly string[];
  minScore?: number | null;
  agentOnly?: boolean;
  /** Resultado del cierre (web-42): sold | resolved | no_response | spam. */
  outcome?: string | null;
  /** Zona IANA de la organización para "hoy" en "Mías" (por defecto UTC). */
  timezone?: string | null;
}

export interface SqlFilter {
  /** Condiciones sin el filtro de agente (para los contadores por agente de la lista). */
  baseConditions: string[];
  baseParams: unknown[];
  conditions: string[];
  params: unknown[];
}

function uniq(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

/**
 * Condiciones parametrizadas de la lista, de los contadores de las vistas guardadas y del lote.
 * - `view=needs` y `view=mine` son colas de trabajo: no las recorta el período.
 * - `view=all` son las abiertas (no cerradas); `view=closed` = `status=closed`.
 * - Dentro de un filtro vale cualquiera de los valores (OR); entre filtros, todos (AND).
 * - Un id de agente o de etiqueta que no es un UUID, o que no es de la organización, no coincide con nada.
 * - Con `search`: contacto (nombre, teléfono, correo) o algún mensaje user/assistant/human, sin
 *   distinguir mayúsculas ni tildes; se ignoran la vista y el periodo (toda la bandeja, también cerradas).
 */
export function buildInboxConditions(input: InboxFilterInput): SqlFilter {
  const conditions: string[] = ['c.organization_id = $1'];
  const params: unknown[] = [input.orgId];
  const next = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  const search = input.search ?? null;
  const view = search ? null : (input.view ?? null);
  if (view === 'needs') conditions.push(NEEDS_SQL);
  if (view === 'mine') {
    const user = next(input.userId);
    conditions.push(mineSql(user, next(input.timezone || 'UTC')));
  }
  if (view === 'all') conditions.push(`c.status <> 'closed'`, NOT_SNOOZED_SQL);
  if (view === 'closed') conditions.push(`c.status = 'closed'`);
  if (input.outcome) conditions.push(`c.closed_outcome = ${next(input.outcome)}`);

  if (input.status) conditions.push(`c.status = ${next(input.status)}`);
  const channels = uniq([...(input.channels ?? []), input.channel]);
  if (channels.length === 1) conditions.push(`c.channel = ${next(channels[0])}`);
  else if (channels.length > 1) conditions.push(`c.channel = ANY(${next(channels)}::text[])`);
  if (search) {
    const p = next(`%${escapeLike(search)}%`);
    const like = (col: string) => `gs_search_norm(${col}) LIKE gs_search_norm(${p}) ESCAPE '\\'`;
    conditions.push(`(${like('co.name')} OR ${like('co.phone')} OR ${like('co.email')}
      OR c.id IN (SELECT sm.conversation_id FROM messages sm
        WHERE sm.role IN ${SEARCHABLE_ROLES_SQL} AND ${like('sm.content')}))`);
  }
  for (const list of [input.labelIds, input.extraLabelIds]) {
    const labelIds = uniq(list ?? []);
    if (labelIds.length === 0) continue;
    const valid = labelIds.filter((id) => UUID_RE.test(id));
    conditions.push(
      valid.length === 0
        ? 'FALSE'
        : `EXISTS (SELECT 1 FROM conversation_labels cl WHERE cl.conversation_id = c.id AND cl.label_id = ANY(${next(valid)}::uuid[]))`
    );
  }
  if (typeof input.minScore === 'number' && Number.isFinite(input.minScore)) {
    conditions.push(`c.ai_score >= ${next(input.minScore)}`);
  }
  if (input.agentOnly) conditions.push(AGENT_ONLY_SQL);
  const queue = view === 'needs' || view === 'mine';
  if (input.range !== 'all' && !queue && !search) conditions.push(RECENT_SQL);

  const baseConditions = [...conditions];
  const baseParams = [...params];
  const agentIds = uniq([...(input.agentIds ?? []), input.agentId]);
  if (agentIds.length > 0) {
    const valid = agentIds.filter((id) => UUID_RE.test(id));
    if (valid.length === 0) conditions.push('FALSE');
    else if (valid.length === 1) conditions.push(`c.agent_id = ${next(valid[0])}`);
    else conditions.push(`c.agent_id = ANY(${next(valid)}::uuid[])`);
  }

  return { baseConditions, baseParams, conditions, params };
}

/**
 * Orden de la lista: por defecto el de siempre; en "Necesitan a alguien", la que más espera primero.
 * En "Mías" (con `followUp`, la expresión de seguimiento ya parametrizada): Seguimiento para hoy,
 * En curso y Pospuestas (la que vuelve antes primero), como los grupos de la pantalla.
 * web-44: `recent` = por el último mensaje; `unread` (con `unread`, la expresión ya parametrizada) =
 * primero las no leídas y después por el último mensaje. Con búsqueda siempre por el último mensaje.
 */
export function inboxOrderBy(
  view: InboxView | null,
  order: string | undefined,
  followUp?: string,
  unread?: string,
  searching = false,
): string {
  if (searching) return 'c.last_message_at DESC NULLS LAST, c.id';
  if (view === 'mine' && followUp) {
    return `CASE WHEN c.snoozed_until IS NOT NULL THEN 2 WHEN ${followUp} THEN 0 ELSE 1 END,
      c.snoozed_until ASC NULLS LAST, c.last_message_at DESC NULLS LAST`;
  }
  if (view === 'needs') return `${WAITING_SINCE_SQL} ASC NULLS LAST, c.last_message_at DESC NULLS LAST`;
  // web-45b: dentro de las que necesitan a alguien, la que más espera primero (como "Necesitan a alguien")
  if (order === 'needs') {
    return `${NEEDS_SQL} DESC, CASE WHEN ${NEEDS_SQL} THEN ${WAITING_SINCE_SQL} END ASC NULLS LAST, c.last_message_at DESC NULLS LAST`;
  }
  if (order === 'unread' && unread) return `${unread} DESC, c.last_message_at DESC NULLS LAST`;
  return 'c.last_message_at DESC NULLS LAST';
}

/**
 * Contadores del riel de la Bandeja. `all`, `closed`, `byAgent` y `byChannel` respetan el período;
 * `needs` y `mine` no (son colas de trabajo, como en la lista). byAgent y byChannel cuentan las abiertas.
 */
export function buildCountsQuery(
  orgId: string,
  userId: string,
  range: string | undefined,
  timezone?: string | null,
): { sql: string; params: unknown[] } {
  const recent = range === 'all' ? 'TRUE' : RECENT_SQL;
  const sql = `SELECT
      COUNT(*) FILTER (WHERE c.status <> 'closed' AND ${NOT_SNOOZED_SQL} AND ${recent}) AS all_count,
      COUNT(*) FILTER (WHERE ${NEEDS_SQL}) AS needs_count,
      COUNT(*) FILTER (WHERE ${mineSql('$2', '$3')}) AS mine_count,
      COUNT(*) FILTER (WHERE c.status = 'closed' AND ${recent}) AS closed_count,
      MIN(${WAITING_SINCE_SQL}) FILTER (WHERE ${NEEDS_SQL}) AS oldest_waiting_since
    ${INBOX_FROM}
    WHERE c.organization_id = $1`;
  return { sql, params: [orgId, userId, timezone || 'UTC'] };
}

export function buildCountsGroupQuery(
  orgId: string,
  range: string | undefined,
  by: 'agent' | 'channel',
): { sql: string; params: unknown[] } {
  const recent = range === 'all' ? '' : ` AND ${RECENT_SQL}`;
  const sql =
    by === 'agent'
      ? `SELECT c.agent_id AS key, a.name AS name, COUNT(*) AS count, a.inbox_paused_at AS paused_at
         FROM conversations c LEFT JOIN agents a ON c.agent_id = a.id
         WHERE c.organization_id = $1 AND c.status <> 'closed' AND c.snoozed_until IS NULL${recent}
         GROUP BY c.agent_id, a.name, a.inbox_paused_at ORDER BY a.name NULLS LAST`
      : `SELECT c.channel AS key, NULL AS name, COUNT(*) AS count, NULL AS paused_at
         FROM conversations c
         WHERE c.organization_id = $1 AND c.status <> 'closed' AND c.snoozed_until IS NULL${recent}
         GROUP BY c.channel ORDER BY COUNT(*) DESC`;
  return { sql, params: [orgId] };
}
