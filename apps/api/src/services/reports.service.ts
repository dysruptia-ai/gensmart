/**
 * Informes de la Bandeja (web-47). Toda métrica de la pantalla de Informes sale de aquí, y las reglas que
 * se repiten (atendida solo por el agente, cuándo una persona atendió un pedido) son constantes SQL.
 *
 * Definiciones:
 * - Conversaciones del período: las de la organización cuyo primer mensaje del cliente (role 'user') cae
 *   en el período.
 * - Atendida solo por el agente: sin `handoff_requested`, sin `taken`/`transferred`/`assigned` y sin
 *   mensajes `human` (HANDLED_BY_AGENT_SQL; también la usa `agent-stats`).
 * - Primera respuesta: mediana de segundos entre el primer mensaje del cliente y la primera respuesta
 *   del agente posterior.
 * - Espera de una persona: mediana de minutos de atención (horario de la organización) entre cada
 *   `handoff_requested` del período y el primer `taken`/`transferred`/`assigned` a una persona o el
 *   primer mensaje `human` posterior. Solo los atendidos.
 * - Meta: % de pedidos atendidos dentro de `response_goal_minutes`. Los sin atender que ya la pasaron
 *   cuentan como no cumplidos; los que siguen dentro de la meta no cuentan.
 */
import {
  HANDOFF_REASONS,
  businessMinutesBetween,
  localParts,
  zonedTimeToInstant,
  type BusinessHours,
  type HandoffReason,
} from '@gensmart/shared';
import { query } from '../config/database';

export type ReportPeriodKey = 'today' | '7d' | '30d';
export const REPORT_PERIODS: readonly ReportPeriodKey[] = ['today', '7d', '30d'];

export function parseReportPeriod(value: unknown): ReportPeriodKey | null {
  return typeof value === 'string' && (REPORT_PERIODS as readonly string[]).includes(value) ? (value as ReportPeriodKey) : null;
}

/** Con más pedidos de ayuda que esto, la espera y la meta se calculan con minutos reales (no de atención). */
export const BUSINESS_MINUTES_MAX_HANDOFFS = 2000;

/** Conversación (alias `c`) atendida solo por el agente: sin pedido de ayuda, sin personas, sin mensajes humanos. */
export const HANDLED_BY_AGENT_SQL = `(NOT EXISTS (
    SELECT 1 FROM conversation_events he
    WHERE he.conversation_id = c.id AND he.type IN ('handoff_requested', 'taken', 'transferred', 'assigned'))
  AND NOT EXISTS (SELECT 1 FROM messages hm WHERE hm.conversation_id = c.id AND hm.role = 'human'))`;

/**
 * El momento en que una persona atendió el pedido de ayuda `e` (alias de conversation_events): el primer
 * taken, transferred o assigned a una persona, o el primer mensaje human, lo que ocurra antes.
 */
export const HANDOFF_ATTENDED_AT_SQL = `LEAST(
  (SELECT MIN(ae.created_at) FROM conversation_events ae
    WHERE ae.conversation_id = e.conversation_id AND ae.created_at >= e.created_at
      AND (ae.type = 'taken' OR (ae.type IN ('transferred', 'assigned') AND ae.target_user_id IS NOT NULL))),
  (SELECT MIN(am.created_at) FROM messages am
    WHERE am.conversation_id = e.conversation_id AND am.role = 'human' AND am.created_at >= e.created_at))`;

// ── período ─────────────────────────────────────────────────────────────────

export interface PeriodBounds {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

function shiftDay(year: number, month: number, day: number, n: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function localMidnight(ymd: { year: number; month: number; day: number }, timeZone: string): Date {
  return zonedTimeToInstant(ymd.year, ymd.month, ymd.day, 0, timeZone);
}

/**
 * Límites del período en la zona de la organización. Los días se cuentan en el calendario local (no
 * sumando 24 h), así los cambios de horario no corren la medianoche.
 */
export function periodBounds(key: ReportPeriodKey, timeZone: string, now: Date = new Date()): PeriodBounds {
  const p = localParts(now, timeZone);
  const today = { year: p.year, month: p.month, day: p.day };
  if (key === 'today') {
    const start = localMidnight(today, timeZone);
    const y = shiftDay(today.year, today.month, today.day, -1);
    const prevStart = localMidnight(y, timeZone);
    const prevEnd = new Date(
      zonedTimeToInstant(y.year, y.month, y.day, p.hour * 60 + p.minute, timeZone).getTime() +
        p.second * 1000 +
        (now.getTime() % 1000)
    );
    return { start, end: now, prevStart, prevEnd: prevEnd > start ? start : prevEnd };
  }
  const days = key === '7d' ? 7 : 30;
  const start = localMidnight(shiftDay(today.year, today.month, today.day, -(days - 1)), timeZone);
  const prevStart = localMidnight(shiftDay(today.year, today.month, today.day, -(2 * days - 1)), timeZone);
  return { start, end: now, prevStart, prevEnd: start };
}

// ── utilidades puras ────────────────────────────────────────────────────────

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function pct(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null;
}

/** La franja de 3 horas seguidas (sin dar la vuelta a la medianoche) con más conversaciones; null con < 10. */
export function peakWindow(byHour: number[], minTotal = 10): { from: number; to: number; pct: number } | null {
  const total = byHour.reduce((a, b) => a + b, 0);
  if (total < minTotal) return null;
  let best = -1;
  let bestFrom = 0;
  for (let h = 0; h + 3 <= 24; h++) {
    const sum = (byHour[h] ?? 0) + (byHour[h + 1] ?? 0) + (byHour[h + 2] ?? 0);
    if (sum > best) {
      best = sum;
      bestFrom = h;
    }
  }
  return { from: bestFrom, to: bestFrom + 3, pct: Math.round((best / total) * 100) };
}

// ── conversaciones ──────────────────────────────────────────────────────────

interface ConversationStats {
  total: number;
  handled: number;
  firstResponseMedian: number | null;
  byHour: number[];
  byChannel: Array<{ channel: string; count: number }>;
  byAgent: Map<string, { conversations: number; handled: number }>;
}

/**
 * La base: conversaciones cuyo primer mensaje del cliente cae en [start, end). El filtro por
 * last_message_at solo descarta las que no tuvieron mensajes desde el inicio (el primero sería anterior).
 */
const BASE_CTE = `base AS MATERIALIZED (
  SELECT c.id, c.agent_id, c.channel, fu.first_at,
         ${HANDLED_BY_AGENT_SQL} AS handled,
         EXTRACT(EPOCH FROM (
           SELECT MIN(ar.created_at) FROM messages ar
           WHERE ar.conversation_id = c.id AND ar.role = 'assistant' AND ar.created_at >= fu.first_at
         ) - fu.first_at) AS frs
  FROM conversations c
  CROSS JOIN LATERAL (
    SELECT MIN(um.created_at) AS first_at FROM messages um WHERE um.conversation_id = c.id AND um.role = 'user'
  ) fu
  WHERE c.organization_id = $1
    AND (c.last_message_at IS NULL OR c.last_message_at >= $2)
    AND fu.first_at >= $2 AND fu.first_at < $3
)`;

export async function conversationStats(organizationId: string, start: Date, end: Date, timeZone: string): Promise<ConversationStats> {
  const r = await query<{
    total: string;
    handled: string;
    frs_median: number | null;
    hours: Array<{ h: number; n: number }>;
    channels: Array<{ channel: string; n: number }>;
    agents: Array<{ agent_id: string | null; n: number; handled: number }>;
  }>(
    `WITH ${BASE_CTE}
     SELECT
       (SELECT COUNT(*) FROM base) AS total,
       (SELECT COUNT(*) FROM base WHERE handled) AS handled,
       (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY frs) FROM base WHERE frs IS NOT NULL) AS frs_median,
       (SELECT COALESCE(json_agg(x), '[]') FROM (
          SELECT EXTRACT(HOUR FROM first_at AT TIME ZONE $4)::int AS h, COUNT(*)::int AS n FROM base GROUP BY 1) x) AS hours,
       (SELECT COALESCE(json_agg(x ORDER BY x.n DESC, x.channel), '[]') FROM (
          SELECT channel, COUNT(*)::int AS n FROM base GROUP BY channel) x) AS channels,
       (SELECT COALESCE(json_agg(x), '[]') FROM (
          SELECT agent_id, COUNT(*)::int AS n, (COUNT(*) FILTER (WHERE handled))::int AS handled FROM base GROUP BY agent_id) x) AS agents`,
    [organizationId, start.toISOString(), end.toISOString(), timeZone]
  );
  const row = r.rows[0]!;
  const byHour = new Array<number>(24).fill(0);
  for (const h of row.hours) if (h.h >= 0 && h.h < 24) byHour[h.h] = h.n;
  const byAgent = new Map<string, { conversations: number; handled: number }>();
  for (const a of row.agents) if (a.agent_id) byAgent.set(a.agent_id, { conversations: a.n, handled: a.handled });
  return {
    total: parseInt(row.total, 10),
    handled: parseInt(row.handled, 10),
    firstResponseMedian: row.frs_median === null ? null : Math.round(Number(row.frs_median)),
    byHour,
    byChannel: row.channels.map((c) => ({ channel: c.channel, count: c.n })),
    byAgent,
  };
}

// ── pedidos de ayuda ────────────────────────────────────────────────────────

export interface HandoffRow {
  requestedAt: Date;
  attendedAt: Date | null;
  closed: boolean;
  reason: HandoffReason | null;
  agentId: string | null;
}

export async function handoffRows(organizationId: string, start: Date, end: Date): Promise<HandoffRow[]> {
  const r = await query<{ created_at: Date; attended_at: Date | null; closed: boolean; reason: string | null; agent_id: string | null }>(
    `SELECT e.created_at, ${HANDOFF_ATTENDED_AT_SQL} AS attended_at, (c.status = 'closed') AS closed,
            e.data->>'reason' AS reason, c.agent_id
     FROM conversation_events e
     JOIN conversations c ON c.id = e.conversation_id
     WHERE e.organization_id = $1 AND e.type = 'handoff_requested' AND e.created_at >= $2 AND e.created_at < $3`,
    [organizationId, start.toISOString(), end.toISOString()]
  );
  return r.rows.map((x) => ({
    requestedAt: new Date(x.created_at),
    attendedAt: x.attended_at ? new Date(x.attended_at) : null,
    closed: x.closed,
    reason: x.reason && (HANDOFF_REASONS as readonly string[]).includes(x.reason) ? (x.reason as HandoffReason) : null,
    agentId: x.agent_id,
  }));
}

export interface HandoffSummary {
  waitMedian: number | null;
  stillWaiting: number;
  goalMet: number;
  goalTotal: number;
  /** true si eran tantos que se usaron minutos reales. */
  realMinutes: boolean;
}

/**
 * Espera y meta de una lista de pedidos. "Siguen esperando" = sin atender en conversaciones abiertas (una
 * cerrada sin que nadie la atendiera ya no espera, pero sí cuenta como meta no cumplida si la pasó).
 */
export function summarizeHandoffs(
  rows: HandoffRow[],
  hours: BusinessHours,
  timeZone: string,
  goalMinutes: number,
  now: Date
): HandoffSummary {
  const realMinutes = rows.length > BUSINESS_MINUTES_MAX_HANDOFFS;
  const minutes = (from: Date, to: Date): number =>
    realMinutes || hours === null
      ? Math.max(0, (to.getTime() - from.getTime()) / 60000)
      : businessMinutesBetween(hours, timeZone, from, to);
  const waits: number[] = [];
  let stillWaiting = 0;
  let met = 0;
  let total = 0;
  for (const h of rows) {
    if (h.attendedAt) {
      const m = minutes(h.requestedAt, h.attendedAt);
      waits.push(m);
      total++;
      if (m <= goalMinutes) met++;
    } else {
      if (!h.closed) stillWaiting++;
      if (minutes(h.requestedAt, now) > goalMinutes) total++;
    }
  }
  const w = median(waits);
  return { waitMedian: w === null ? null : Math.round(w * 10) / 10, stillWaiting, goalMet: met, goalTotal: total, realMinutes };
}

// ── el informe completo ─────────────────────────────────────────────────────

export interface InboxReport {
  period: { key: ReportPeriodKey; start: string; end: string; timeZone: string };
  previous: { start: string; end: string };
  planAllowsPeople: boolean;
  responseGoalMinutes: number;
  kpis: {
    agentResolved: { pct: number | null; count: number; total: number; prevPct: number | null };
    firstResponseSeconds: { median: number | null; prev: number | null };
    humanWaitMinutes: { median: number | null; prev: number | null; stillWaiting: number } | null;
    goalMet: { pct: number | null; met: number; total: number; prevPct: number | null } | null;
  };
  byHour: number[];
  peak: { from: number; to: number; pct: number } | null;
  byChannel: Array<{ channel: string; count: number }>;
  handoffReasons: Array<{ reason: HandoffReason | null; count: number; pct: number }>;
  agents: Array<{
    agentId: string;
    name: string;
    conversations: number;
    resolvedAlone: number;
    resolvedAlonePct: number | null;
    askedHelp: number;
    status: 'active' | 'paused' | 'unpublished';
  }>;
  /** Solo para el reporte interno: si la espera se calculó con minutos reales por volumen. */
  realMinutes?: boolean;
}

export interface BuildReportInput {
  organizationId: string;
  period: ReportPeriodKey;
  timeZone: string;
  planAllowsPeople: boolean;
  businessHours: BusinessHours;
  responseGoalMinutes: number;
  now?: Date;
}

export async function buildInboxReport(input: BuildReportInput): Promise<InboxReport> {
  const now = input.now ?? new Date();
  const { organizationId: org, timeZone: tz } = input;
  const b = periodBounds(input.period, tz, now);
  const [cur, prev, handoffs, prevHandoffs, agentRows] = await Promise.all([
    conversationStats(org, b.start, b.end, tz),
    conversationStats(org, b.prevStart, b.prevEnd, tz),
    handoffRows(org, b.start, b.end),
    input.planAllowsPeople ? handoffRows(org, b.prevStart, b.prevEnd) : Promise.resolve([] as HandoffRow[]),
    query<{ id: string; name: string; status: string | null; inbox_paused_at: Date | null }>(
      'SELECT id, name, status, inbox_paused_at FROM agents WHERE organization_id = $1',
      [org]
    ),
  ]);

  let people: InboxReport['kpis']['humanWaitMinutes'] = null;
  let goal: InboxReport['kpis']['goalMet'] = null;
  let realMinutes = false;
  if (input.planAllowsPeople) {
    const s = summarizeHandoffs(handoffs, input.businessHours, tz, input.responseGoalMinutes, now);
    const p = summarizeHandoffs(prevHandoffs, input.businessHours, tz, input.responseGoalMinutes, now);
    realMinutes = s.realMinutes || p.realMinutes;
    people = { median: s.waitMedian, prev: p.waitMedian, stillWaiting: s.stillWaiting };
    goal = { pct: pct(s.goalMet, s.goalTotal), met: s.goalMet, total: s.goalTotal, prevPct: pct(p.goalMet, p.goalTotal) };
  }

  const reasonCounts = new Map<HandoffReason | null, number>();
  const helpByAgent = new Map<string, number>();
  for (const h of handoffs) {
    reasonCounts.set(h.reason, (reasonCounts.get(h.reason) ?? 0) + 1);
    if (h.agentId) helpByAgent.set(h.agentId, (helpByAgent.get(h.agentId) ?? 0) + 1);
  }
  const handoffReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count, pct: Math.round((count / handoffs.length) * 100) }))
    .sort((a, b2) => b2.count - a.count);

  const agents = agentRows.rows
    .map((a) => {
      const s = cur.byAgent.get(a.id) ?? { conversations: 0, handled: 0 };
      const status: 'active' | 'paused' | 'unpublished' =
        a.status !== 'active' ? 'unpublished' : a.inbox_paused_at ? 'paused' : 'active';
      return {
        agentId: a.id,
        name: a.name,
        conversations: s.conversations,
        resolvedAlone: s.handled,
        resolvedAlonePct: pct(s.handled, s.conversations),
        askedHelp: helpByAgent.get(a.id) ?? 0,
        status,
      };
    })
    .sort((x, y) => y.conversations - x.conversations || x.name.localeCompare(y.name));

  return {
    period: { key: input.period, start: b.start.toISOString(), end: b.end.toISOString(), timeZone: tz },
    previous: { start: b.prevStart.toISOString(), end: b.prevEnd.toISOString() },
    planAllowsPeople: input.planAllowsPeople,
    responseGoalMinutes: input.responseGoalMinutes,
    kpis: {
      agentResolved: { pct: pct(cur.handled, cur.total), count: cur.handled, total: cur.total, prevPct: pct(prev.handled, prev.total) },
      firstResponseSeconds: { median: cur.firstResponseMedian, prev: prev.firstResponseMedian },
      humanWaitMinutes: people,
      goalMet: goal,
    },
    byHour: cur.byHour,
    peak: peakWindow(cur.byHour),
    byChannel: cur.byChannel,
    handoffReasons,
    agents,
    ...(realMinutes ? { realMinutes } : {}),
  };
}
