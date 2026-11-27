import type { CloseOutcome, ConversationRow, InboxFilters, InboxOrder, InboxView, MinScore, SavedViewFilters } from './types';
import { CLOSE_OUTCOMES, INBOX_ORDERS, INBOX_VIEWS, MIN_SCORES } from './types';

type T = (key: string, values?: Record<string, string | number>) => string;

const locale = (language: string) => (language === 'es' ? 'es' : 'en');

/** "hace 5 min" / "5 min ago". Por encima de una semana, la fecha corta. */
export function relativeTime(iso: string | null, language: string, now = Date.now()): string {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale(language), { numeric: 'auto', style: 'short' });
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(locale(language), { day: 'numeric', month: 'short' }).format(date);
}

/** "12 min" / "2 h 5 min" desde `since` hasta ahora. */
export function waitDuration(since: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function clockTime(iso: string, language: string, timeZone?: string | null): string {
  return new Intl.DateTimeFormat(locale(language), {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}

// ── zona horaria de la organización (web-42) ────────────────────────────────

/** La zona de Ajustes si es válida; si no, `undefined` (= la del navegador). */
export function validTimeZone(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
}

function wallTime(date: Date, timeZone?: string): WallTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdays.indexOf(get('weekday')),
  };
}

/** El instante en que en `timeZone` son las `hour:minute` del día (y, m, d). Tolera días que se desbordan. */
export function zonedInstant(y: number, m: number, d: number, hour: number, minute: number, timeZone?: string): Date {
  const target = Date.UTC(y, m - 1, d, hour, minute);
  let guess = target;
  // Dos pasadas bastan para corregir el desfase de la zona (y el cambio de horario)
  for (let i = 0; i < 2; i++) {
    const w = wallTime(new Date(guess), timeZone);
    const seen = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
    guess += target - seen;
  }
  return new Date(guess);
}

export type SnoozeOption = 'in1h' | 'today16' | 'tomorrow9' | 'nextWeek';

/** Las opciones de "Posponer" con su instante. "Hoy 4:00 p. m." solo si todavía no pasó. */
export function snoozeOptions(now: Date, timeZone?: string): Array<{ key: SnoozeOption; until: Date }> {
  const w = wallTime(now, timeZone);
  const out: Array<{ key: SnoozeOption; until: Date }> = [{ key: 'in1h', until: new Date(now.getTime() + 3600_000) }];
  const today16 = zonedInstant(w.year, w.month, w.day, 16, 0, timeZone);
  if (today16.getTime() - now.getTime() > 60_000) out.push({ key: 'today16', until: today16 });
  out.push({ key: 'tomorrow9', until: zonedInstant(w.year, w.month, w.day + 1, 9, 0, timeZone) });
  // El lunes que viene (si hoy es lunes, el de la otra semana)
  const toMonday = ((8 - w.weekday) % 7) || 7;
  out.push({ key: 'nextWeek', until: zonedInstant(w.year, w.month, w.day + toMonday, 9, 0, timeZone) });
  return out;
}

/** "hoy 4:00 p. m." / "mañana 9:00 a. m." / "lunes 1 de diciembre, 9:00 a. m." en la zona de la organización. */
export function snoozeLabel(iso: string, language: string, t: T, timeZone?: string, now = new Date()): string {
  const date = new Date(iso);
  const time = clockTime(iso, language, timeZone);
  const a = wallTime(date, timeZone);
  const b = wallTime(now, timeZone);
  const days = Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000);
  if (days === 0) return t('inbox.snooze.todayAt', { time });
  if (days === 1) return t('inbox.snooze.tomorrowAt', { time });
  const day = new Intl.DateTimeFormat(locale(language), { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(date);
  return t('inbox.snooze.dateAt', { day, time });
}

export function parseOutcome(value: string | null | undefined): CloseOutcome | null {
  return (CLOSE_OUTCOMES as readonly string[]).includes(value ?? '') ? (value as CloseOutcome) : null;
}

/** Separador de día del hilo: "Hoy", "Ayer" o la fecha. */
export function dayLabel(iso: string, language: string, t: T, now = new Date()): string {
  const date = new Date(iso);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86400000);
  if (days === 0) return t('inbox.thread.today');
  if (days === 1) return t('inbox.thread.yesterday');
  return new Intl.DateTimeFormat(locale(language), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Nombre del contacto, o su teléfono o correo si no hay nombre. */
export function contactName(
  contact: { name: string | null; phone: string | null; email: string | null } | null,
  fallback: string,
): string {
  return contact?.name?.trim() || contact?.phone || contact?.email || fallback;
}

export function initialsOf(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!clean || /^\d/.test(clean)) return '';
  const parts = clean.split(/\s+/);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : parts[0]!.slice(0, 2);
  return letters.toUpperCase();
}

/** Puntaje del lead con un decimal, o null. */
export function formatScore(score: number | null | undefined): string | null {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return null;
  return Number(score).toFixed(1);
}

// ── URL ─────────────────────────────────────────────────────────────────────
// Nombres cortos (convención de web-41): agent, channel, label, score, order, savedView. Los filtros con
// varios valores van separados por comas; `agent=x` y `channel=x` de antes siguen abriendo lo mismo.
// También se aceptan los nombres largos de la API (agentIds, channels, labelIds, minScore).

function readList(params: URLSearchParams, ...names: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    for (const raw of params.getAll(name)) {
      for (const part of raw.split(',')) {
        const v = part.trim();
        if (v && !out.includes(v)) out.push(v);
      }
    }
  }
  return out;
}

export function parseMinScore(value: string | null | undefined): MinScore | null {
  const n = Number(value);
  return (MIN_SCORES as readonly number[]).includes(n) ? (n as MinScore) : null;
}

export const EMPTY_FILTERS: InboxFilters = {
  view: 'all',
  agentIds: [],
  channels: [],
  labelIds: [],
  minScore: null,
  allTime: false,
  outcome: null,
  order: 'needs',
  savedView: null,
};

export function readFilters(params: URLSearchParams): InboxFilters {
  const view = params.get('view');
  const order = params.get('order');
  return {
    view: (INBOX_VIEWS as readonly string[]).includes(view ?? '') ? (view as InboxView) : 'all',
    agentIds: readList(params, 'agent', 'agentIds', 'agentId'),
    channels: readList(params, 'channel', 'channels'),
    labelIds: readList(params, 'label', 'labelIds'),
    minScore: parseMinScore(params.get('score') ?? params.get('minScore')),
    allTime: params.get('range') === 'all',
    outcome: view === 'closed' ? parseOutcome(params.get('outcome')) : null,
    order: (INBOX_ORDERS as readonly string[]).includes(order ?? '') ? (order as InboxOrder) : 'needs',
    savedView: params.get('savedView') || null,
  };
}

export function filtersQuery(filters: InboxFilters): string {
  const q = new URLSearchParams();
  if (filters.savedView) q.set('savedView', filters.savedView);
  else if (filters.view !== 'all') q.set('view', filters.view);
  if (filters.agentIds.length) q.set('agent', filters.agentIds.join(','));
  if (filters.channels.length) q.set('channel', filters.channels.join(','));
  if (filters.labelIds.length) q.set('label', filters.labelIds.join(','));
  if (filters.minScore) q.set('score', String(filters.minScore));
  if (!filters.savedView && filters.allTime) q.set('range', 'all');
  if (!filters.savedView && filters.view === 'closed' && filters.outcome) q.set('outcome', filters.outcome);
  if (!filters.savedView && filters.view === 'all' && filters.order !== 'needs') q.set('order', filters.order);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function inboxHref(filters: InboxFilters, conversationId: string | null): string {
  return `/dashboard/conversations${conversationId ? `/${conversationId}` : ''}${filtersQuery(filters)}`;
}

/** Cuántos filtros del panel están puestos (el número del botón). */
export function activeFilterCount(filters: InboxFilters): number {
  return filters.agentIds.length + filters.channels.length + filters.labelIds.length + (filters.minScore ? 1 : 0);
}

/** Parámetros de `GET /api/conversations` para unos filtros. */
export function listApiQuery(filters: InboxFilters, search: string, page: number, limit: number): string {
  const q = new URLSearchParams({ view: filters.view, page: String(page), limit: String(limit) });
  if (filters.savedView) q.set('savedView', filters.savedView);
  if (filters.view === 'all' && !filters.savedView) q.set('order', filters.order);
  if (filters.agentIds.length) q.set('agentIds', filters.agentIds.join(','));
  if (filters.channels.length) q.set('channels', filters.channels.join(','));
  if (filters.labelIds.length) q.set('labelIds', filters.labelIds.join(','));
  if (filters.minScore) q.set('minScore', String(filters.minScore));
  if (filters.allTime) q.set('range', 'all');
  if (filters.view === 'closed' && filters.outcome) q.set('outcome', filters.outcome);
  if (search) q.set('search', search);
  return q.toString();
}

/** Los criterios de una vista guardada como filtros de la lista (estado → vista). */
export function savedViewAsFilters(f: SavedViewFilters): Pick<InboxFilters, 'view' | 'allTime'> & { agentOnly: boolean } {
  const state = f.state ?? 'open';
  const view: InboxView = state === 'needs' ? 'needs' : state === 'mine' ? 'mine' : state === 'closed' ? 'closed' : 'all';
  return { view, allTime: !!f.allTime, agentOnly: state === 'agent_only' };
}

/** "Solo el agente" (misma regla que la API): abierta con el agente, sin pedido de ayuda y sin posponer. */
export function isAgentOnly(row: ConversationRow): boolean {
  return row.status === 'active' && !row.handoffActive && !row.snoozedUntil;
}

/** Canal, agente, etiqueta y puntaje (OR dentro de cada uno, AND entre ellos). */
function matchesCriteria(
  row: ConversationRow,
  c: { agentIds?: string[]; channels?: string[]; labelIds?: string[]; minScore?: number | null },
): boolean {
  if (c.agentIds?.length && !c.agentIds.includes(row.agentId)) return false;
  if (c.channels?.length && !c.channels.includes(row.channel)) return false;
  if (c.labelIds?.length && !(row.labels ?? []).some((l) => c.labelIds!.includes(l.id))) return false;
  if (c.minScore && !(row.aiScore !== null && row.aiScore >= c.minScore)) return false;
  return true;
}

/**
 * ¿La fila cumple la vista y los filtros? (para quitarla o dejarla tras un evento en tiempo real).
 * Con una vista guardada, `saved` trae sus criterios. Con búsqueda la lista no se toca (`searching`).
 */
export function rowMatches(
  row: ConversationRow,
  filters: InboxFilters,
  userId: string | undefined,
  saved?: SavedViewFilters | null,
  searching = false,
): boolean {
  if (!matchesCriteria(row, filters)) return false;
  if (searching) return true;
  let view = filters.view;
  let outcome = filters.outcome;
  if (saved) {
    if (!matchesCriteria(row, saved)) return false;
    const s = savedViewAsFilters(saved);
    if (s.agentOnly && !isAgentOnly(row)) return false;
    view = s.view;
    outcome = null;
  }
  const snoozed = !!row.snoozedUntil;
  switch (view) {
    case 'needs':
      return row.needsAttention && !snoozed;
    case 'mine':
      return isMine(row, userId);
    case 'closed':
      return row.status === 'closed' && (!outcome || row.closedOutcome === outcome);
    default:
      return row.status !== 'closed' && !snoozed;
  }
}

/** "Mías" (misma regla que la API): las que tengo tomadas y las que pospuse sin dueño. */
export function isMine(row: ConversationRow, userId: string | undefined): boolean {
  if (!userId || row.status === 'closed') return false;
  if (row.takenOverBy === userId && row.status === 'human_takeover') return true;
  return !row.takenOverBy && row.snoozedBy === userId && (!!row.snoozedUntil || !!row.followUpPending);
}

/** Grupo de "Mías": Seguimiento para hoy, En curso o Pospuestas. */
export function mineGroup(row: ConversationRow): 'followUp' | 'active' | 'snoozed' {
  if (row.snoozedUntil) return 'snoozed';
  if (row.followUpPending) return 'followUp';
  return 'active';
}

/** Recalcula "necesita a alguien" y la espera después de un cambio local (misma regla que la API). */
export function withNeeds(row: ConversationRow, lastCustomerAt: string | null): ConversationRow {
  const askedForHelp = row.handoffActive && !row.takenOverBy && row.status !== 'closed';
  const takenUnanswered = row.status === 'human_takeover' && row.lastMessage?.role === 'user';
  const needsAttention = (askedForHelp || takenUnanswered) && !row.snoozedUntil;
  const waitingSince = askedForHelp ? row.handedOffAt : takenUnanswered ? lastCustomerAt ?? row.lastMessageAt : null;
  return { ...row, needsAttention, waitingSince };
}

/** Orden de la lista: en "Todas", primero las que necesitan a alguien; en "Necesitan", la que más espera. */
export function sortRows(rows: ConversationRow[], view: InboxView, order: InboxOrder = 'needs'): ConversationRow[] {
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const copy = [...rows];
  if (view === 'needs') {
    copy.sort((a, b) => time(a.waitingSince) - time(b.waitingSince));
  } else if (view === 'mine') {
    const order = { followUp: 0, active: 1, snoozed: 2 } as const;
    copy.sort(
      (a, b) =>
        order[mineGroup(a)] - order[mineGroup(b)] ||
        time(a.snoozedUntil ?? null) - time(b.snoozedUntil ?? null) ||
        time(b.lastMessageAt) - time(a.lastMessageAt),
    );
  } else {
    copy.sort((a, b) => {
      if (view === 'all' && order === 'needs' && a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
      if (view === 'all' && order === 'unread' && !!a.unread !== !!b.unread) return a.unread ? -1 : 1;
      return time(b.lastMessageAt) - time(a.lastMessageAt);
    });
  }
  return copy;
}
