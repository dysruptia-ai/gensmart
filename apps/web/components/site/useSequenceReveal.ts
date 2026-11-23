'use client';

import { useLayoutEffect, type RefObject } from 'react';

/**
 * Entrada en secuencia (una sola vez) cuando el bloque entra en pantalla.
 * Pone `data-seq="hidden"` y luego `data-seq="go"` en el elemento; el CSS decide qué se anima.
 * El estado oculto solo se aplica después de montar, con IntersectionObserver, sin
 * reduced-motion y si el bloque todavía no está en pantalla: sin JS todo se ve de entrada.
 */
export function useSequenceReveal(ref: RefObject<HTMLElement | null>, threshold = 0.2): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;

    el.dataset['seq'] = 'hidden';
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset['seq'] = 'go';
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      // Si se desmonta antes de entrar, no deja nada oculto
      if (el.dataset['seq'] === 'hidden') delete el.dataset['seq'];
    };
  }, [ref, threshold]);
}
