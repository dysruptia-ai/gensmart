'use client';

import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';

interface RovingTabs {
  active: number;
  /** Activa una pestaña; con `focus`, le pasa el foco (teclado). */
  select: (i: number, focus?: boolean) => void;
  listRef: RefObject<HTMLDivElement | null>;
  tabRef: (i: number) => (el: HTMLButtonElement | null) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Pestañas con `tabindex` móvil (patrón del índice de Soluciones): flechas
 * (circulares), Inicio y Fin mueven el foco y activan la pestaña. Si la fila
 * se desplaza (móvil), centra la activa dentro de la lista, nunca la página.
 * `active`/`onChange` opcionales: estado controlado desde fuera.
 */
export function useRovingTabs(
  count: number,
  controlled?: { active: number; onChange: (i: number) => void }
): RovingTabs {
  const [own, setOwn] = useState(0);
  const active = controlled ? controlled.active : own;
  const setActive = controlled ? controlled.onChange : setOwn;
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (i: number, focus = false) => {
    setActive(i);
    const tab = tabRefs.current[i];
    const list = listRef.current;
    if (!tab || !list) return;
    if (focus) tab.focus({ preventScroll: true });
    if (list.scrollWidth > list.clientWidth) {
      const left = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
      list.scrollTo({ left, behavior: 'smooth' });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = count - 1;
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = active === last ? 0 : active + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = active === 0 ? last : active - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    select(next, true);
  };

  const tabRef = (i: number) => (el: HTMLButtonElement | null) => {
    tabRefs.current[i] = el;
  };

  return { active, select, listRef, tabRef, onKeyDown };
}
