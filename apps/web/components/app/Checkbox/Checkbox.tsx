'use client';

import React, { useId } from 'react';
import { Check } from 'lucide-react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  /** Texto de la casilla. Puede llevar enlaces. */
  children: React.ReactNode;
  error?: string;
  id?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

/** Casilla con etiqueta real y error enlazado. Estados: reposo, hover, foco, marcada, inválida y deshabilitada. */
export default function Checkbox({ children, error, id, inputRef, className, ...input }: CheckboxProps) {
  const autoId = useId();
  const boxId = id ?? `c${autoId}`;
  const errorId = error ? `${boxId}-error` : undefined;
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <div className={styles.row}>
        <span className={styles.box}>
          <input
            {...input}
            ref={inputRef}
            id={boxId}
            type="checkbox"
            className={styles.input}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
          />
          <Check className={styles.mark} size={14} strokeWidth={3} aria-hidden="true" />
        </span>
        <label htmlFor={boxId} className={styles.label}>
          {children}
        </label>
      </div>
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
