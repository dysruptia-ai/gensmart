'use client';

import React from 'react';
import styles from './ChoiceList.module.css';

export interface ChoiceOption<V extends string> {
  value: V;
  label: string;
  hint?: string;
}

export interface ChoiceListProps<V extends string> {
  name: string;
  /** Texto para lectores de pantalla (el grupo de opciones). */
  legend: string;
  options: ReadonlyArray<ChoiceOption<V>>;
  value: V | null;
  onChange: (value: V) => void;
}

/** Opciones de un solo valor (radio) de los cuadros de la Bandeja: transferir, posponer y cerrar. */
export default function ChoiceList<V extends string>({ name, legend, options, value, onChange }: ChoiceListProps<V>) {
  return (
    <fieldset className={styles.list}>
      <legend className="gsSr">{legend}</legend>
      {options.map((o, i) => (
        <label key={o.value} className={styles.option}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            data-autofocus={value === o.value || (value === null && i === 0) ? true : undefined}
          />
          <span className={styles.text}>
            <b>{o.label}</b>
            {o.hint && <small>{o.hint}</small>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
