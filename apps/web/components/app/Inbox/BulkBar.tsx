'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { CircleCheckBig, Forward, Tag, Trash2, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { bulkBarLevel } from './bulkBarFit';
import styles from './BulkBar.module.css';

export interface BulkBarProps {
  count: number;
  /** El plan Solo no ve "Asignar". */
  canAssign: boolean;
  /** Solo owner y admin borran. */
  canDelete: boolean;
  onAssign: () => void;
  onClose: () => void;
  onLabel: () => void;
  onDelete: () => void;
  onExit: () => void;
  /** Móvil: reemplaza la navegación inferior (4 acciones, sin el número). */
  mobile?: boolean;
}

/**
 * Barra de acciones con la selección (web-44). Flotante dentro de la columna de la lista y nunca la
 * desborda: si los textos no caben pasa a íconos con aria-label (se mide, como useHeaderFit).
 */
export default function BulkBar({ count, canAssign, canDelete, onAssign, onClose, onLabel, onDelete, onExit, mobile }: BulkBarProps) {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(false);
  const textWidths = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || mobile) return;
    const fit = () => {
      // Guarda el ancho con texto de cada acción la primera vez que se ve así
      const buttons = Array.from(bar.querySelectorAll<HTMLElement>('[data-text-action]'));
      for (const btn of buttons) if (!compact) textWidths.current.set(btn.dataset['textAction'] ?? '', btn.offsetWidth);
      const widths = buttons.map((btn) => textWidths.current.get(btn.dataset['textAction'] ?? ''));
      if (widths.some((w) => w === undefined)) {
        setCompact(false);
        return;
      }
      const cs = getComputedStyle(bar);
      const level = bulkBarLevel({
        width: bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        countWidth: countRef.current?.scrollWidth ?? 0,
        textWidths: widths as number[],
        fixedIcons: bar.querySelectorAll('[data-fixed-icon]').length,
        iconWidth: 34,
        gap: parseFloat(cs.columnGap) || 4,
      });
      setCompact(level === 1);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [compact, mobile, count, canAssign, canDelete]);

  const icons = compact && !mobile;
  const action = (key: string, label: string, Icon: typeof Tag, run: () => void, opts: { danger?: boolean; short?: string } = {}) => {
    // Escritorio: Borrar es siempre ícono. Móvil: texto corto ("Borrar") y el número en aria-label
    const iconOnly = !mobile && (opts.danger || icons);
    const visible = mobile ? (opts.short ?? label) : label;
    return (
      <button
        key={key}
        type="button"
        className={[styles.action, opts.danger && styles.danger, iconOnly && styles.iconOnly].filter(Boolean).join(' ')}
        onClick={run}
        aria-label={iconOnly || (mobile && opts.short) ? label : undefined}
        title={iconOnly ? label : undefined}
        data-text-action={!mobile && !opts.danger ? key : undefined}
        data-fixed-icon={!mobile && opts.danger ? '' : undefined}
      >
        <Icon size={mobile ? 20 : 16} aria-hidden="true" />
        {!iconOnly && <span>{visible}</span>}
      </button>
    );
  };
  const actionCount = 2 + (canAssign ? 1 : 0) + (canDelete ? 1 : 0);

  return (
    <div
      ref={barRef}
      className={`${styles.bar} ${mobile ? styles.mobile : ''}`}
      style={mobile ? { gridTemplateColumns: `repeat(${actionCount}, minmax(0, 1fr))` } : undefined}
      role="toolbar"
      aria-label={t('inbox.bulk.toolbar', { count })}
    >
      {!mobile && <span ref={countRef} className={styles.count}>{t('inbox.bulk.selected', { count })}</span>}
      {canAssign && action('assign', t('inbox.bulk.assign'), Forward, onAssign)}
      {action('close', t('inbox.bulk.close'), CircleCheckBig, onClose)}
      {action('label', t('inbox.bulk.label'), Tag, onLabel)}
      {canDelete && action('delete', t('inbox.bulk.delete', { count }), Trash2, onDelete, { danger: true, short: t('inbox.bulk.deleteShort') })}
      {!mobile && (
        <button type="button" data-fixed-icon="" className={`${styles.action} ${styles.iconOnly}`} onClick={onExit} aria-label={t('inbox.bulk.exit')} title={t('inbox.bulk.exit')}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
