'use client';

import React, { useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { INBOX_LIMITS } from '@gensmart/shared';
import { useTranslation } from '@/hooks/useTranslation';
import CheckList, { type CheckOption } from './CheckList';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import { MIN_SCORES, VIEW_STATES, type MinScore, type SavedView, type SavedViewFilters, type ViewState } from './types';
import styles from './SavedViewDialog.module.css';

export interface SavedViewDialogProps {
  /** null = Nueva vista. */
  view: SavedView | null;
  /** Criterios con los que llega (desde "Guardar como vista"). */
  initial?: SavedViewFilters;
  channels: CheckOption[];
  agents: CheckOption[];
  labels: CheckOption[];
  onCancel: () => void;
  onSave: (name: string, filters: SavedViewFilters) => Promise<'ok' | 'taken' | 'error'>;
  onDelete?: () => Promise<boolean>;
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface PillsProps<V extends string> {
  legend: string;
  name: string;
  options: ReadonlyArray<{ value: V; label: string }>;
  value: V;
  onChange: (v: V) => void;
}

function Pills<V extends string>({ legend, name, options, value, onChange }: PillsProps<V>) {
  return (
    <fieldset className={styles.pills}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.pillRow}>
        {options.map((o) => (
          <label key={o.value} className={styles.pill}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "Nueva vista" / "Editar vista" (web-44). Las vistas son personales: solo las ve quien las crea. */
export default function SavedViewDialog({ view, initial, channels, agents, labels, onCancel, onSave, onDelete }: SavedViewDialogProps) {
  const { t } = useTranslation();
  const nameId = useId();
  const start = view?.filters ?? initial ?? {};
  const [name, setName] = useState(view?.name ?? '');
  const [chosenChannels, setChannels] = useState<string[]>(start.channels ?? []);
  const [chosenAgents, setAgents] = useState<string[]>(start.agentIds ?? []);
  const [chosenLabels, setLabels] = useState<string[]>(start.labelIds ?? []);
  const [score, setScore] = useState<'any' | `${MinScore}`>(start.minScore ? (String(start.minScore) as `${MinScore}`) : 'any');
  const [state, setState] = useState<ViewState>(start.state ?? 'open');
  const [period, setPeriod] = useState<'all' | 'recent'>(start.allTime ? 'all' : 'recent');
  const [error, setError] = useState<'' | 'empty' | 'taken' | 'failed'>('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const max = INBOX_LIMITS.savedViewNameMax;

  // Las opciones incluyen lo ya elegido aunque no aparezca en los contadores
  const withChosen = (opts: CheckOption[], chosen: string[]) => [
    ...opts,
    ...chosen.filter((v) => !opts.some((o) => o.value === v)).map((v) => ({ value: v, label: v })),
  ];

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('empty');
      nameRef.current?.focus();
      return;
    }
    const filters: SavedViewFilters = {
      state,
      allTime: period === 'all',
      ...(chosenChannels.length ? { channels: chosenChannels } : {}),
      ...(chosenAgents.length ? { agentIds: chosenAgents } : {}),
      ...(chosenLabels.length ? { labelIds: chosenLabels } : {}),
      ...(score !== 'any' ? { minScore: Number(score) as MinScore } : {}),
    };
    setBusy(true);
    const result = await onSave(trimmed, filters);
    setBusy(false);
    if (result === 'taken') {
      setError('taken');
      nameRef.current?.focus();
    } else if (result === 'error') {
      setError('failed');
    }
  };

  if (confirmDelete && view && onDelete) {
    return (
      <InboxDialog
        title={t('inbox.views.deleteTitle')}
        onClose={() => setConfirmDelete(false)}
        initialFocusRef={cancelDeleteRef}
        footer={
          <>
            <InboxButton ref={cancelDeleteRef} onClick={() => setConfirmDelete(false)}>
              {t('inbox.deleteDialog.cancel')}
            </InboxButton>
            <InboxButton
              variant="danger"
              icon={Trash2}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await onDelete();
                setBusy(false);
                if (!ok) setError('failed');
              }}
            >
              {t('inbox.views.delete')}
            </InboxButton>
          </>
        }
      >
        <p>{t('inbox.views.deleteText', { name: view.name })}</p>
        {error === 'failed' && (
          <p className={styles.error} role="alert">
            {t('inbox.views.saveError')}
          </p>
        )}
      </InboxDialog>
    );
  }

  return (
    <InboxDialog
      title={view ? t('inbox.views.edit') : t('inbox.views.new')}
      onClose={onCancel}
      initialFocusRef={nameRef}
      footer={
        <>
          {view && onDelete && (
            <InboxButton variant="ghost" icon={Trash2} className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
              {t('inbox.views.delete')}
            </InboxButton>
          )}
          <InboxButton onClick={onCancel}>{t('inbox.deleteDialog.cancel')}</InboxButton>
          <InboxButton variant="primary" onClick={() => void save()} loading={busy}>
            {t('inbox.views.save')}
          </InboxButton>
        </>
      }
    >
      <div className={styles.form}>
        <label className={styles.field} htmlFor={nameId}>
          <span className={styles.fieldHead}>
            <span>{t('inbox.views.name')}</span>
            <small aria-hidden="true">{t('inbox.views.nameCount', { n: [...name].length, max })}</small>
          </span>
          <input
            ref={nameRef}
            id={nameId}
            value={name}
            maxLength={max}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void save();
              }
            }}
            aria-invalid={error === 'empty' || error === 'taken' || undefined}
            aria-describedby={error ? `${nameId}-err` : undefined}
            placeholder={t('inbox.views.namePlaceholder')}
          />
          {(error === 'empty' || error === 'taken') && (
            <small id={`${nameId}-err`} className={styles.error} role="alert">
              {error === 'empty' ? t('inbox.views.nameRequired') : t('inbox.views.nameTaken')}
            </small>
          )}
        </label>

        {channels.length + chosenChannels.length > 0 && (
          <CheckList
            legend={t('inbox.filters.channel')}
            options={withChosen(channels, chosenChannels)}
            selected={chosenChannels}
            onToggle={(v) => setChannels((l) => toggle(l, v))}
          />
        )}
        {agents.length > 0 && (
          <CheckList
            legend={t('inbox.filters.agent')}
            options={agents}
            selected={chosenAgents}
            onToggle={(v) => setAgents((l) => toggle(l, v))}
          />
        )}
        <CheckList
          legend={t('inbox.filters.label')}
          options={labels}
          selected={chosenLabels}
          onToggle={(v) => setLabels((l) => toggle(l, v))}
          searchPlaceholder={t('inbox.filters.labelSearch')}
          emptyText={t('inbox.filters.noLabels')}
        />
        <Pills
          legend={t('inbox.views.minScore')}
          name={`${nameId}-score`}
          value={score}
          onChange={setScore}
          options={[
            { value: 'any', label: t('inbox.views.scoreAny') },
            ...MIN_SCORES.map((n) => ({ value: String(n) as `${MinScore}`, label: t('inbox.views.scoreMin', { n }) })),
          ]}
        />
        <Pills
          legend={t('inbox.views.state')}
          name={`${nameId}-state`}
          value={state}
          onChange={setState}
          options={VIEW_STATES.map((s) => ({ value: s, label: t(`inbox.views.states.${s}`) }))}
        />
        <Pills
          legend={t('inbox.list.period')}
          name={`${nameId}-period`}
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'all', label: t('inbox.list.allTime') },
            { value: 'recent', label: t('inbox.list.last8days') },
          ]}
        />
        {error === 'failed' && (
          <p className={styles.error} role="alert">
            {t('inbox.views.saveError')}
          </p>
        )}
      </div>
    </InboxDialog>
  );
}
