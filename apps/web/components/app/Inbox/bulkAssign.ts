/**
 * Bandeja (web-44): antes de confirmar "Asignar N", cuáles se van a saltar y por qué, con las mismas
 * reglas de Transferir que aplica la API (quien la tiene o un owner/admin; un miembro no se la asigna a
 * sí mismo; recibir una que ya tiene esa persona; las cerradas).
 */
import type { ConversationRow } from './types';

export type AssignSkip =
  | { kind: 'closed' }
  | { kind: 'notTaken' }
  | { kind: 'takenBy'; name: string }
  | { kind: 'alreadyHas' }
  | { kind: 'self' };

export function assignSkipFor(
  row: ConversationRow,
  toUserId: string | null,
  me: string | undefined,
  isManager: boolean,
  teamFallback: string,
): AssignSkip | null {
  if (row.status === 'closed') return { kind: 'closed' };
  const holder = row.status === 'human_takeover' ? row.takenOverBy : null;
  if (holder !== me && !isManager) {
    return holder ? { kind: 'takenBy', name: row.takeoverUserName || teamFallback } : { kind: 'notTaken' };
  }
  if (toUserId && toUserId === holder) return { kind: 'alreadyHas' };
  if (toUserId && toUserId === me && !isManager) return { kind: 'self' };
  return null;
}

/** Los saltos agrupados para el aviso: "1 la tiene Diego R.", "2 no las tiene nadie"… */
export function groupSkips(skips: ReadonlyArray<AssignSkip>): Array<{ key: string; kind: AssignSkip['kind']; name?: string; count: number }> {
  const out = new Map<string, { key: string; kind: AssignSkip['kind']; name?: string; count: number }>();
  for (const s of skips) {
    const key = s.kind === 'takenBy' ? `takenBy:${s.name}` : s.kind;
    const g = out.get(key) ?? { key, kind: s.kind, ...(s.kind === 'takenBy' ? { name: s.name } : {}), count: 0 };
    g.count++;
    out.set(key, g);
  }
  return [...out.values()];
}

/** El motivo que más se repite entre las omitidas (para el aviso final). */
export function topSkipReason(skipped: ReadonlyArray<{ reason: string }>): string | null {
  const counts = new Map<string, number>();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const [reason, n] of counts) if (n > max) [best, max] = [reason, n];
  return best;
}
