import React from 'react';
import styles from './BarList.module.css';

export interface BarListItem {
  key: string;
  label: string;
  /** El ancho de la barra, de 0 a 100. */
  pct: number;
  /** Lo que va a la derecha ("12", "34 %"). */
  value: string;
  /** Texto completo para lectores de pantalla ("Web: 12"). */
  srLabel?: string;
  color?: string;
}

/** Barras horizontales con el número a la derecha (`.rp-bars` del diseño). */
export default function BarList({ items }: { items: BarListItem[] }) {
  return (
    <ul className={styles.bars}>
      {items.map((x) => (
        <li key={x.key} aria-label={x.srLabel} style={x.color ? ({ '--bar': x.color } as React.CSSProperties) : undefined}>
          <span className={styles.name}>
            {x.color && <i aria-hidden="true" />}
            <span className={styles.text}>{x.label}</span>
          </span>
          <em className={styles.track} aria-hidden="true">
            <u style={{ width: `${Math.max(0, Math.min(100, x.pct))}%` }} data-color={x.color ? '' : undefined} />
          </em>
          <b className={styles.value}>{x.value}</b>
        </li>
      ))}
    </ul>
  );
}
