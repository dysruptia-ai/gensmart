/**
 * Bandeja (web-44): los filtros de la lista que llegan por la URL.
 *
 * `channels`, `agentIds` y `labelIds` aceptan "a,b" o el parámetro repetido. `agentId` y `channel`
 * (un solo valor, de antes) se siguen aceptando y se suman a la lista. Un valor de más no da error:
 * un id ajeno o mal escrito simplemente no coincide con nada (lo resuelve buildInboxConditions).
 */
import type { InboxFilterInput } from './inbox-query.service';

/** Tope por lista: suficiente para cualquier pantalla, y la consulta no crece sin límite. */
const MAX_VALUES = 100;

export function parseList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    for (const part of item.split(',')) {
      const v = part.trim();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out.slice(0, MAX_VALUES);
}

export function parseMinScore(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}

export type ListFilters = Pick<InboxFilterInput, 'channels' | 'agentIds' | 'labelIds' | 'minScore' | 'agentOnly'>;

export function parseListFilters(q: Record<string, unknown>): ListFilters {
  return {
    channels: [...parseList(q['channels']), ...parseList(q['channel'])],
    agentIds: [...parseList(q['agentIds']), ...parseList(q['agentId'])],
    labelIds: parseList(q['labelIds']),
    minScore: parseMinScore(q['minScore']),
    agentOnly: q['agentOnly'] === '1' || q['agentOnly'] === 'true',
  };
}
