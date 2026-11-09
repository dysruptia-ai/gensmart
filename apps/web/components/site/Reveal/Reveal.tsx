'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './Reveal.module.css';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Retraso de la transición en ms (para entradas escalonadas) */
  delay?: number;
}

/**
 * Entrada al hacer scroll. El estado oculto se aplica por DOM solo después de montar,
 * así que sin JS (o sin IntersectionObserver / con reduced-motion) el contenido se ve.
 */
export default function Reveal({ children, className, delay }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.dataset['reveal'] = 'hidden';
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset['reveal'] = 'shown';
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={[styles.reveal, className].filter(Boolean).join(' ')}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
