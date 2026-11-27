'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { INBOX_LIMITS } from '@gensmart/shared';
import { trapTab } from '@/lib/focus-trap';
import { useTranslation } from '@/hooks/useTranslation';
import { fold } from './quickReplies';
import type { InboxLabel, LabelRef } from './types';
import styles from './LabelPicker.module.css';

export interface LabelPickerProps {
  catalog: InboxLabel[] | null;
  selected: LabelRef[];
  /** Guarda de inmediato (optimista; quien lo llama revierte si la API falla). */
  onChange: (next: LabelRef[]) => void;
  /** owner y admin: "+ Crear «texto»". */
  canCreate: boolean;
  onCreate: (name: string) => Promise<{ label: InboxLabel } | { error: string }>;
  onClose: () => void;
  /** Lado del que se abre (el menú "Más" está a la derecha). */
  align?: 'left' | 'right';
  /** Hacia dónde se abre: en la ficha va hacia arriba (la sección está al final del panel). */
  direction?: 'down' | 'up';
}

/** Selector de etiquetas (web-43): popover anclado, con buscador y casillas. Esc o un clic afuera lo cierran. */
/** Lo que la pantalla le pasa al selector; el lugar donde se ancla lo pone cada uno. */
export type LabelPickerData = Omit<LabelPickerProps, 'onClose' | 'align' | 'direction'>;

export default function LabelPicker({ catalog, selected, onChange, canCreate, onCreate, onClose, align = 'left', direction = 'down' }: LabelPickerProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) closeRef.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const selectedIds = new Set(selected.map((l) => l.id));
  const atLimit = selected.length >= INBOX_LIMITS.labelsPerConversation;
  const q = query.trim();
  const fq = fold(q);
  const visible = (catalog ?? []).filter((l) => !fq || fold(l.name).includes(fq));
  const exact = !!q && (catalog ?? []).some((l) => l.name.toLocaleLowerCase() === q.toLocaleLowerCase());
  const tooLong = [...q].length > INBOX_LIMITS.labelNameMaxChars;

  function toggle(label: LabelRef, checked: boolean) {
    onChange(checked ? [...selected, { id: label.id, name: label.name }] : selected.filter((l) => l.id !== label.id));
  }

  async function create() {
    if (!q || exact || creating || tooLong) return;
    setCreating(true);
    setProblem(null);
    const r = await onCreate(q);
    setCreating(false);
    if ('label' in r) {
      setQuery('');
      if (!atLimit) toggle(r.label, true);
    } else {
      setProblem(
        r.error === 'label_taken' ? t('inbox.labels.taken') : r.error === 'labels_limit' ? t('inbox.labels.orgLimit') : t('inbox.labels.createError'),
      );
    }
  }

  return (
    <div
      ref={boxRef}
      className={[styles.picker, align === 'right' && styles.right, direction === 'up' && styles.up].filter(Boolean).join(' ')}
      role="dialog"
      aria-label={t('inbox.labels.pickerLabel')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        trapTab(e, boxRef.current);
      }}
    >
      <label className={styles.search}>
        <Search size={14} aria-hidden="true" />
        <span className="gsSr">{t('inbox.labels.search')}</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setProblem(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canCreate && q && !exact) void create();
            }
          }}
          placeholder={t('inbox.labels.search')}
          maxLength={INBOX_LIMITS.labelNameMaxChars + 10}
        />
      </label>

      {catalog === null ? (
        <p className={styles.note}>{t('inbox.labels.loading')}</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((label) => {
            const checked = selectedIds.has(label.id);
            const disabled = !checked && atLimit;
            return (
              <li key={label.id}>
                <label className={`${styles.option} ${disabled ? styles.disabled : ''}`}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => toggle(label, e.target.checked)} />
                  <span className={styles.name}>{label.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {catalog !== null && visible.length === 0 && !q && <p className={styles.note}>{t('inbox.labels.noneYet')}</p>}

      {q && !exact && canCreate && (
        <button type="button" className={styles.create} onClick={() => void create()} disabled={creating || tooLong || atLimit}>
          <Plus size={14} aria-hidden="true" />
          {t('inbox.labels.create', { name: q })}
        </button>
      )}
      {q && !exact && !canCreate && visible.length === 0 && <p className={styles.note}>{t('inbox.labels.askAdmin')}</p>}
      {tooLong && canCreate && <p className={styles.problem}>{t('inbox.labels.tooLong', { max: INBOX_LIMITS.labelNameMaxChars })}</p>}
      {atLimit && (
        <p className={styles.note} id={`${baseId}-limit`}>
          {t('inbox.labels.convLimit', { max: INBOX_LIMITS.labelsPerConversation })}
        </p>
      )}
      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
