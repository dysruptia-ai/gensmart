import type { ConversationRow, InboxFilters, InboxView } from './types';
import { INBOX_VIEWS } from './types';

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

export function clockTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(locale(language), { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
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

export function readFilters(params: URLSearchParams): InboxFilters {
  const view = params.get('view');
  return {
    view: (INBOX_VIEWS as readonly string[]).includes(view ?? '') ? (view as InboxView) : 'all',
    agentId: params.get('agent') || null,
    channel: params.get('channel') || null,
    allTime: params.get('range') === 'all',
  };
}

export function filtersQuery(filters: InboxFilters): string {
  const q = new URLSearchParams();
  if (filters.view !== 'all') q.set('view', filters.view);
  if (filters.agentId) q.set('agent', filters.agentId);
  if (filters.channel) q.set('channel', filters.channel);
  if (filters.allTime) q.set('range', 'all');
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function inboxHref(filters: InboxFilters, conversationId: string | null): string {
  return `/dashboard/conversations${conversationId ? `/${conversationId}` : ''}${filtersQuery(filters)}`;
}

/** Parámetros de `GET /api/conversations` para unos filtros. */
export function listApiQuery(filters: InboxFilters, search: string, page: number, limit: number): string {
  const q = new URLSearchParams({ view: filters.view, page: String(page), limit: String(limit) });
  if (filters.view === 'all') q.set('order', 'needs');
  if (filters.agentId) q.set('agentId', filters.agentId);
  if (filters.channel) q.set('channel', filters.channel);
  if (filters.allTime) q.set('range', 'all');
  if (search) q.set('search', search);
  return q.toString();
}

/** ¿La fila cumple la vista? (para quitarla o dejarla tras un evento en tiempo real). */
export function rowMatches(row: ConversationRow, filters: InboxFilters, userId: string | undefined): boolean {
  if (filters.agentId && row.agentId !== filters.agentId) return false;
  if (filters.channel && row.channel !== filters.channel) return false;
  switch (filters.view) {
    case 'needs':
      return row.needsAttention;
    case 'mine':
      return row.status !== 'closed' && !!userId && row.takenOverBy === userId;
    case 'closed':
      return row.status === 'closed';
    default:
      return row.status !== 'closed';
  }
}

/** Recalcula "necesita a alguien" y la espera después de un cambio local (misma regla que la API). */
export function withNeeds(row: ConversationRow, lastCustomerAt: string | null): ConversationRow {
  const askedForHelp = row.handoffActive && !row.takenOverBy && row.status !== 'closed';
  const takenUnanswered = row.status === 'human_takeover' && row.lastMessage?.role === 'user';
  const needsAttention = askedForHelp || takenUnanswered;
  const waitingSince = askedForHelp ? row.handedOffAt : takenUnanswered ? lastCustomerAt ?? row.lastMessageAt : null;
  return { ...row, needsAttention, waitingSince };
}

/** Orden de la lista: en "Todas", primero las que necesitan a alguien; en "Necesitan", la que más espera. */
export function sortRows(rows: ConversationRow[], view: InboxView): ConversationRow[] {
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const copy = [...rows];
  if (view === 'needs') {
    copy.sort((a, b) => time(a.waitingSince) - time(b.waitingSince));
  } else {
    copy.sort((a, b) => {
      if (view === 'all' && a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
      return time(b.lastMessageAt) - time(a.lastMessageAt);
    });
  }
  return copy;
}
