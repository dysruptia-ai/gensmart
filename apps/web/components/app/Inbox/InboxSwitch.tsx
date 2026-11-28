'use client';

import React from 'react';
import styles from './InboxSwitch.module.css';

export interface InboxSwitchProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  /** Nombre accesible (lo que dice el texto de al lado). */
  label: string;
  /** Deshabilitado: no se puede tocar (miembros). */
  disabled?: boolean;
  /** Bloqueado por el plan: se ve, recibe foco y anuncia por qué (aria-disabled), pero no cambia. */
  locked?: boolean;
  describedBy?: string;
  id?: string;
}

/** Interruptor de la Bandeja (web-45): `role="switch"` con `aria-checked`, como el `.tg` del diseño. */
export default function InboxSwitch({ checked, onChange, label, disabled, locked, describedBy, id }: InboxSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      aria-disabled={locked || undefined}
      disabled={disabled}
      className={[styles.switch, locked && styles.locked].filter(Boolean).join(' ')}
      onClick={() => {
        if (!locked && !disabled) onChange?.(!checked);
      }}
    />
  );
}
