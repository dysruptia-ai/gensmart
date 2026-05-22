'use client';

import React from 'react';
import { Link as LinkIcon } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import type { ConfigVariableSchema, ConfigVariableValue } from './types';
import styles from './ConfigVariablesEditor.module.css';

interface Props {
  variable: ConfigVariableSchema;
  value: ConfigVariableValue;
  error: string | null;
  language: 'en' | 'es';
  saving?: boolean;
  onChange: (key: string, value: ConfigVariableValue) => void;
  onCommit: (key: string, value: ConfigVariableValue) => void;
}

function label(v: ConfigVariableSchema, lang: 'en' | 'es'): string {
  return (lang === 'es' ? v.label_es : v.label_en) || v.key;
}

function description(v: ConfigVariableSchema, lang: 'en' | 'es'): string | undefined {
  return lang === 'es' ? v.description_es : v.description_en;
}

function placeholder(v: ConfigVariableSchema, lang: 'en' | 'es'): string | undefined {
  return lang === 'es' ? v.placeholder_es : v.placeholder_en;
}

export default function ConfigVariableField({
  variable,
  value,
  error,
  language,
  saving,
  onChange,
  onCommit,
}: Props) {
  const id = `cfg-${variable.key}`;
  const labelText = label(variable, language);
  const helperText = description(variable, language);
  const placeholderText = placeholder(variable, language);

  const renderInput = () => {
    switch (variable.type) {
      case 'textarea':
        return (
          <textarea
            id={id}
            className={styles.textarea}
            value={(value as string | null) ?? ''}
            placeholder={placeholderText}
            rows={4}
            onChange={(e) => onChange(variable.key, e.target.value)}
            onBlur={(e) => onCommit(variable.key, e.target.value)}
            aria-invalid={!!error}
          />
        );
      case 'number':
        return (
          <input
            id={id}
            type="number"
            className={styles.input}
            value={value === null || value === undefined ? '' : String(value)}
            placeholder={placeholderText}
            min={variable.min}
            max={variable.max}
            onChange={(e) => onChange(variable.key, e.target.value)}
            onBlur={(e) => {
              const raw = e.target.value;
              if (raw === '') return onCommit(variable.key, null);
              const n = Number(raw);
              onCommit(variable.key, Number.isNaN(n) ? raw : n);
            }}
            aria-invalid={!!error}
          />
        );
      case 'boolean':
        return (
          <Toggle
            id={id}
            checked={value === true}
            onChange={(checked) => {
              onChange(variable.key, checked);
              onCommit(variable.key, checked);
            }}
          />
        );
      case 'url':
        return (
          <div className={styles.iconInputWrap}>
            <span className={styles.iconLeft} aria-hidden="true">
              <LinkIcon size={16} />
            </span>
            <input
              id={id}
              type="url"
              className={`${styles.input} ${styles.inputWithIcon}`}
              value={(value as string | null) ?? ''}
              placeholder={placeholderText ?? 'https://...'}
              onChange={(e) => onChange(variable.key, e.target.value)}
              onBlur={(e) => onCommit(variable.key, e.target.value)}
              aria-invalid={!!error}
            />
          </div>
        );
      case 'enum': {
        const opts = variable.options ?? [];
        // Radio group when ≤ 4, select otherwise — same threshold as the spec.
        if (opts.length <= 4) {
          return (
            <div className={styles.radioGroup} role="radiogroup" aria-labelledby={`${id}-label`}>
              {opts.map((opt) => {
                const optLabel = language === 'es' ? opt.label_es : opt.label_en;
                return (
                  <label key={opt.value} className={styles.radioOption}>
                    <input
                      type="radio"
                      name={id}
                      value={opt.value}
                      checked={value === opt.value}
                      onChange={() => {
                        onChange(variable.key, opt.value);
                        onCommit(variable.key, opt.value);
                      }}
                    />
                    <span>{optLabel}</span>
                  </label>
                );
              })}
            </div>
          );
        }
        return (
          <select
            id={id}
            className={styles.select}
            value={(value as string | null) ?? ''}
            onChange={(e) => {
              onChange(variable.key, e.target.value);
              onCommit(variable.key, e.target.value);
            }}
            aria-invalid={!!error}
          >
            <option value="">--</option>
            {opts.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {language === 'es' ? opt.label_es : opt.label_en}
              </option>
            ))}
          </select>
        );
      }
      case 'string':
      default:
        return (
          <input
            id={id}
            type="text"
            className={styles.input}
            value={(value as string | null) ?? ''}
            placeholder={placeholderText}
            maxLength={variable.max}
            onChange={(e) => onChange(variable.key, e.target.value)}
            onBlur={(e) => onCommit(variable.key, e.target.value)}
            aria-invalid={!!error}
          />
        );
    }
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} id={`${id}-label`} className={styles.label}>
        {labelText}
        {variable.required && (
          <span className={styles.required} aria-label="required">
            {' *'}
          </span>
        )}
        {saving && <span className={styles.savingDot} aria-hidden="true" />}
      </label>
      {renderInput()}
      {error && (
        <span className={styles.errorText} role="alert">
          {error}
        </span>
      )}
      {!error && helperText && <span className={styles.hint}>{helperText}</span>}
    </div>
  );
}
