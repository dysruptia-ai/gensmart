'use client';

import React from 'react';
import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean | undefined;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export default function Toggle({ checked, onChange, label, disabled = false, id }: ToggleProps) {
  const inputId = id ?? (label ? `toggle-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const isChecked = checked ?? false;

  return (
    <label
      className={[styles.wrapper, disabled ? styles.disabled : ''].filter(Boolean).join(' ')}
      htmlFor={inputId}
    >
      <input
        type="checkbox"
        role="switch"
        id={inputId}
        className={styles.input}
        checked={isChecked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-checked={isChecked}
      />
      <div
        className={[styles.track, isChecked ? styles.checked : ''].join(' ')}
        aria-hidden="true"
      >
        <div className={styles.thumb} />
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
