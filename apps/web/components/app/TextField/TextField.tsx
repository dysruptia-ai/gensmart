'use client';

import React, { useId } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Contenido al lado de la etiqueta (por ejemplo "¿Olvidaste tu contraseña?"). */
  labelAside?: React.ReactNode;
  help?: React.ReactNode;
  error?: string;
  id?: string;
  /** Botón dentro del campo, a la derecha (mostrar/ocultar contraseña). */
  trailing?: React.ReactNode;
  /** Ids extra para `aria-describedby` (por ejemplo, la lista de reglas). */
  describedBy?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * Campo con etiqueta real, ayuda y error enlazados (`aria-describedby`, `aria-invalid`).
 * Estados: reposo, hover, foco visible, inválido y deshabilitado.
 */
export default function TextField({
  label,
  labelAside,
  help,
  error,
  id,
  trailing,
  describedBy,
  inputRef,
  className,
  ...input
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? `f${autoId}`;
  const helpId = help ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const described = [describedBy, helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={fieldId}>
          {label}
        </label>
        {labelAside && <span className={styles.aside}>{labelAside}</span>}
      </div>
      <div className={[styles.control, trailing ? styles.withTrailing : ''].join(' ')}>
        <input
          {...input}
          ref={inputRef}
          id={fieldId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
        />
        {trailing && <span className={styles.trailing}>{trailing}</span>}
      </div>
      {help && (
        <p className={styles.help} id={helpId}>
          {help}
        </p>
      )}
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
