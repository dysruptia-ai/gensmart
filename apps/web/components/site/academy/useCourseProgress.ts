'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Avance de un curso de Academy: los índices de las lecciones marcadas, en `localStorage`
 * (`gs-academy-<id>`), solo en este navegador. El servidor y la hidratación ven 0; el avance
 * guardado se aplica justo después. Si `localStorage` no está disponible (bloqueado, modo
 * privado estricto) todo funciona igual, sin guardar: se recuerda solo mientras la página
 * esté abierta.
 */
const EVENT = 'gs-academy-progress';
const memory = new Map<string, string>();

const storageKey = (courseId: string) => `gs-academy-${courseId}`;

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? '';
  } catch {
    return memory.get(key) ?? '';
  }
}

function write(key: string, value: string): void {
  memory.set(key, value);
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Sin localStorage: queda en memoria
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Índices válidos (0…total-1), sin repetir, desde el valor guardado (`[0,2]`). */
function parse(raw: string, total: number): number[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const valid = value.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < total);
    return [...new Set(valid)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export interface CourseProgress {
  done: readonly number[];
  count: number;
  isDone: (lesson: number) => boolean;
  toggle: (lesson: number, checked: boolean) => void;
}

export function useCourseProgress(courseId: string, total: number): CourseProgress {
  const key = storageKey(courseId);
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => ''
  );
  const done = useMemo(() => parse(raw, total), [raw, total]);
  const toggle = useCallback(
    (lesson: number, checked: boolean) => {
      const current = parse(read(key), total).filter((n) => n !== lesson);
      const next = checked ? [...current, lesson].sort((a, b) => a - b) : current;
      write(key, next.length ? JSON.stringify(next) : '');
    },
    [key, total]
  );
  const isDone = useCallback((lesson: number) => done.includes(lesson), [done]);
  return { done, count: done.length, isDone, toggle };
}
