'use client';

import React, { useId } from 'react';
import styles from './ChoiceGroup.module.css';

export interface ChoiceOption<V extends string> {
  value: V;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface BaseProps<V extends string> {
  /** Texto del `legend`. */
  legend: string;
  /** El `legend` solo para lectores de pantalla (cuando el título del paso ya lo dice). */
  legendHidden?: boolean;
  options: ReadonlyArray<ChoiceOption<V>>;
  /** `cards`: tarjetas en una columna; `grid`: tarjetas en dos columnas; `pills`: pastillas. */
  layout?: 'cards' | 'grid' | 'pills';
  /** Ayuda debajo del grupo (por ejemplo, por qué una opción está deshabilitada). */
  hint?: string;
}

interface SingleProps<V extends string> extends BaseProps<V> {
  multiple?: false;
  value: V | null;
  onChange: (value: V) => void;
}

interface MultipleProps<V extends string> extends BaseProps<V> {
  multiple: true;
  value: readonly V[];
  onChange: (value: V, checked: boolean) => void;
}

export type ChoiceGroupProps<V extends string> = SingleProps<V> | MultipleProps<V>;

/**
 * Grupo de opciones del cuestionario: `fieldset` con `legend`, radios (una opción) o casillas
 * (varias) nativos, así que se maneja con teclado como cualquier formulario.
 */
export default function ChoiceGroup<V extends string>(props: ChoiceGroupProps<V>) {
  const { legend, legendHidden, options, layout = 'cards', hint } = props;
  const name = useId();
  const hintId = hint ? `${name}-hint` : undefined;
  const type = props.multiple ? 'checkbox' : 'radio';

  return (
    <fieldset className={`${styles.group} ${styles[layout]}`} aria-describedby={hintId}>
      <legend className={legendHidden ? 'gsSr' : styles.legend}>{legend}</legend>
      {options.map((o) => {
        const id = `${name}-${o.value}`;
        const checked = props.multiple ? props.value.includes(o.value) : props.value === o.value;
        return (
          <div key={o.value} className={`${styles.opt} ${type === 'checkbox' ? styles.cb : ''}`}>
            <input
              type={type}
              id={id}
              name={name}
              value={o.value}
              checked={checked}
              disabled={o.disabled}
              onChange={(e) => {
                if (props.multiple) props.onChange(o.value, e.target.checked);
                else props.onChange(o.value);
              }}
            />
            <label htmlFor={id}>
              {o.label}
              {o.description && <small>{o.description}</small>}
            </label>
          </div>
        );
      })}
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
    </fieldset>
  );
}
