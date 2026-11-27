/**
 * Bandeja (web-44): las casillas de tres estados de "Etiquetar N".
 *  - all: la tienen todas las seleccionadas (marcada)
 *  - none: no la tiene ninguna (vacía)
 *  - some: la tienen algunas ("–", aria-checked="mixed"); no se toca si no se cambia
 * Cada toque: marcada en todas → vacía en todas → el estado inicial (y vuelta a empezar).
 */

export type TriState = 'all' | 'none' | 'some';

export interface LabelTally {
  /** En cuántas de las seleccionadas está. */
  count: number;
  total: number;
  initial: TriState;
}

export function initialState(count: number, total: number): TriState {
  if (count <= 0) return 'none';
  if (count >= total) return 'all';
  return 'some';
}

/** Por etiqueta, en cuántas conversaciones seleccionadas está. */
export function tallyLabels(selections: ReadonlyArray<ReadonlyArray<string>>): Map<string, number> {
  const out = new Map<string, number>();
  for (const labels of selections) for (const id of new Set(labels)) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

/** El siguiente estado al tocar: all → none → inicial; si el inicial era all o none, alterna entre los dos. */
export function nextState(current: TriState, initial: TriState): TriState {
  if (current === 'all') return 'none';
  if (current === 'none') return initial === 'some' ? 'some' : 'all';
  return 'all';
}

/** Lo que se manda a la API: solo las etiquetas que cambiaron respecto de su estado inicial. */
export function labelDelta(
  states: ReadonlyMap<string, TriState>,
  initial: ReadonlyMap<string, TriState>,
): { add: string[]; remove: string[] } {
  const add: string[] = [];
  const remove: string[] = [];
  for (const [id, state] of states) {
    const from = initial.get(id) ?? 'none';
    if (state === from) continue;
    if (state === 'all') add.push(id);
    else if (state === 'none') remove.push(id);
  }
  return { add, remove };
}

/** Qué va a pasar con una etiqueta: "se pone en N" o "se quita de N" (null si no cambia). */
export function changeNote(state: TriState, from: TriState, count: number, total: number): { kind: 'add' | 'remove'; n: number } | null {
  if (state === from) return null;
  if (state === 'all') return { kind: 'add', n: total - count };
  if (state === 'none') return { kind: 'remove', n: count };
  return null;
}
