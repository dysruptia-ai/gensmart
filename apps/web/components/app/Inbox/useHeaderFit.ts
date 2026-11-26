import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Cuánto texto llevan las acciones de la cabecera del hilo (web-42b):
 *   0 = todas con texto · 1 = las secundarias (`data-fit="secondary"`) solo con ícono · 2 = todas con ícono.
 * Se elige el menor nivel con el que el nombre del contacto cabe completo, midiendo la cabecera con
 * ResizeObserver (no con un ancho de ventana fijo).
 *
 * Cada botón marcado con `data-fit` guarda su ancho con texto la primera vez que se ve así; con eso se
 * calcula cuánto espacio libera al pasar a ícono sin tener que volver a dibujarlo con texto.
 */
export type HeaderFitLevel = 0 | 1 | 2;

const ICON_WIDTH = 36;

export function useHeaderFit(deps: readonly unknown[]) {
  const headRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const textWidths = useRef(new Map<string, number>());
  const [level, setLevel] = useState<HeaderFitLevel>(0);
  const levelRef = useRef<HeaderFitLevel>(0);

  const apply = useCallback((next: HeaderFitLevel) => {
    if (levelRef.current === next) return;
    levelRef.current = next;
    setLevel(next);
  }, []);

  const fit = useCallback(() => {
    const name = nameRef.current;
    const actions = actionsRef.current;
    if (!name || !actions) return;
    const current = levelRef.current;
    const buttons = Array.from(actions.querySelectorAll<HTMLElement>('[data-fit]'));
    let extraNow = 0;
    let extraPrimary = 0;
    let extraSecondary = 0;
    for (const b of buttons) {
      const kind = b.dataset['fit'];
      const key = `${kind}:${b.textContent ?? ''}`;
      const isText = current === 0 || (current === 1 && kind === 'primary');
      if (isText) textWidths.current.set(key, b.offsetWidth);
      const w = textWidths.current.get(key);
      if (w === undefined) {
        // Un botón nuevo que nunca se vio con texto: se dibuja todo con texto una vez para medirlo
        apply(0);
        return;
      }
      const extra = Math.max(0, w - ICON_WIDTH);
      if (isText) extraNow += extra;
      if (kind === 'primary') extraPrimary += extra;
      else extraSecondary += extra;
    }
    // Ancho natural del nombre (aunque ahora esté cortado) y el que tendría con todas las acciones en ícono
    const range = document.createRange();
    range.selectNodeContents(name);
    const need = Math.ceil(range.getBoundingClientRect().width);
    const roomAllIcons = name.clientWidth + extraNow;
    if (roomAllIcons - extraPrimary - extraSecondary >= need) apply(0);
    else if (roomAllIcons - extraPrimary >= need) apply(1);
    else apply(2);
  }, [apply]);

  useLayoutEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, level, ...deps]);

  useLayoutEffect(() => {
    const head = headRef.current;
    if (!head || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(head);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, ...deps]);

  return { headRef, nameRef, actionsRef, level };
}
