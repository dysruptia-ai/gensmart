'use client';

import React, { useRef } from 'react';
import styles from './CodeInput.module.css';

export interface CodeInputProps {
  /** Los 6 dígitos (cadena de hasta 6). */
  value: string;
  onChange: (value: string) => void;
  /** Etiqueta del grupo, enlazada con `aria-labelledby`. */
  labelId: string;
  /** Nombre accesible de cada casilla: recibe el número (1 a 6). */
  digitLabel: (n: number) => string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** Se llama cuando se completan los 6 dígitos. */
  onComplete?: (value: string) => void;
  firstInputRef?: React.RefObject<HTMLInputElement | null>;
}

const LENGTH = 6;

/**
 * Código de 6 dígitos: avanza solo, Backspace retrocede, las flechas mueven y pegar el código
 * completo (en cualquier casilla) lo reparte. La primera casilla lleva `autocomplete="one-time-code"`.
 */
export default function CodeInput({
  value,
  onChange,
  labelId,
  digitLabel,
  invalid,
  describedBy,
  disabled,
  onComplete,
  firstInputRef,
}: CodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  function focusAt(i: number) {
    const el = refs.current[Math.max(0, Math.min(LENGTH - 1, i))];
    el?.focus();
    el?.select();
  }

  function commit(next: string[]) {
    const joined = next.join('').replace(/\D/g, '').slice(0, LENGTH);
    onChange(joined);
    if (joined.length === LENGTH) onComplete?.(joined);
  }

  function fill(from: number, text: string) {
    const clean = text.replace(/\D/g, '');
    if (!clean) return;
    // Un código completo (pegado o autocompletado) siempre empieza en la primera casilla
    const start = clean.length >= LENGTH ? 0 : from;
    const next = [...digits];
    for (let k = 0; k < clean.length && start + k < LENGTH; k++) next[start + k] = clean[k];
    commit(next);
    focusAt(Math.min(start + clean.length, LENGTH - 1));
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 1) {
      fill(i, raw);
      return;
    }
    const next = [...digits];
    next[i] = raw;
    commit(next);
    if (raw && i < LENGTH - 1) focusAt(i + 1);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        commit(next);
      } else if (i > 0) {
        e.preventDefault();
        const next = [...digits];
        next[i - 1] = '';
        commit(next);
        focusAt(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      e.preventDefault();
      focusAt(i + 1);
    }
  }

  function handlePaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!text.replace(/\D/g, '')) return;
    e.preventDefault();
    fill(i, text);
  }

  return (
    <div className={styles.row} role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
            if (i === 0 && firstInputRef) firstInputRef.current = el;
          }}
          className={styles.digit}
          value={d}
          inputMode="numeric"
          pattern="[0-9]*"
          // La primera recibe el código completo del gestor/SMS; las demás no deben autocompletar
          maxLength={i === 0 ? LENGTH : 1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
