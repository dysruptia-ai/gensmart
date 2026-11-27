'use client';

import React, { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { foldText } from './inboxSearch';
import styles from './CheckList.module.css';

export interface CheckOption {
  value: string;
  label: string;
  /** Color del punto (canales). */
  dot?: string;
  hint?: string;
}

export interface CheckListProps {
  legend: string;
  options: ReadonlyArray<CheckOption>;
  selected: ReadonlyArray<string>;
  onToggle: (value: string) => void;
  /** Con buscador (etiquetas). */
  searchPlaceholder?: string;
  emptyText?: string;
}

/** Casillas reales (`<label>` + checkbox) para elegir varios valores: el panel de filtros y las vistas. */
export default function CheckList({ legend, options, selected, onToggle, searchPlaceholder, emptyText }: CheckListProps) {
  const id = useId();
  const [q, setQ] = useState('');
  const fq = foldText(q.trim());
  const shown = fq ? options.filter((o) => foldText(o.label).includes(fq)) : options;
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      {searchPlaceholder && options.length > 6 && (
        <label className={styles.search} htmlFor={`${id}-q`}>
          <Search size={14} aria-hidden="true" />
          <input
            id={`${id}-q`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </label>
      )}
      {shown.length === 0 && emptyText && <p className={styles.empty}>{emptyText}</p>}
      <div className={styles.options}>
        {shown.map((o) => (
          <label key={o.value} className={styles.option}>
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
            {o.dot && <i className={styles.dot} style={{ background: o.dot }} aria-hidden="true" />}
            <span className={styles.label}>{o.label}</span>
            {o.hint && <small className={styles.hint}>{o.hint}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
