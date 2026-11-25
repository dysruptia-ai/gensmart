'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import TextField, { type TextFieldProps } from '../TextField/TextField';
import styles from './PasswordField.module.css';

export interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'trailing'> {
  autoComplete: 'current-password' | 'new-password';
  showLabel: string;
  hideLabel: string;
  /** Nombre accesible del botón (por ejemplo "Mostrar contraseña"). */
  showAria: string;
  hideAria: string;
}

/** Campo de contraseña con botón mostrar/ocultar (`aria-pressed`). */
export default function PasswordField({ showLabel, hideLabel, showAria, hideAria, ...field }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...field}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      spellCheck={false}
      trailing={
        <button
          type="button"
          className={styles.eye}
          aria-pressed={visible}
          aria-label={visible ? hideAria : showAria}
          onClick={() => setVisible((v) => !v)}
          disabled={field.disabled}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          <span aria-hidden="true">{visible ? hideLabel : showLabel}</span>
        </button>
      }
    />
  );
}
