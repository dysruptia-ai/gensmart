'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { useCourseProgress } from './useCourseProgress';
import styles from './CourseProgress.module.css';

interface ProgressProps {
  courseId: string;
  total: number;
}

/** Barra de avance: el ancho es el único estilo dinámico (`--p`). */
export function ProgressBar({ count, total, className }: { count: number; total: number; className?: string }) {
  const style = { '--p': `${total ? (count / total) * 100 : 0}%` } as CSSProperties;
  return (
    <i className={[styles.bar, className].filter(Boolean).join(' ')} aria-hidden="true">
      <u style={style} />
    </i>
  );
}

/**
 * "x/N hechas" de la tarjeta. Siempre ocupa su lugar (también con 0), para que aplicar el
 * avance guardado al hidratar no mueva el layout.
 */
export function CardProgress({ courseId, total }: ProgressProps) {
  const { t } = useSiteTranslation();
  const { count } = useCourseProgress(courseId, total);
  return (
    <div className={styles.card}>
      <span className={styles.cardText}>{t('site.academy.card.done', { count, total })}</span>
      <ProgressBar count={count} total={total} />
    </div>
  );
}

/** Marca de curso terminado sobre la ilustración (decorativa: el texto ya dice N/N). */
export function CompleteMark({ courseId, total, className, children }: ProgressProps & { className?: string; children: ReactNode }) {
  const { count } = useCourseProgress(courseId, total);
  return (
    <i className={className} aria-hidden="true" hidden={count < total}>
      {children}
    </i>
  );
}
