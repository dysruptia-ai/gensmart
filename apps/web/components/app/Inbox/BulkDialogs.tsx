'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, RefreshCw, Search } from 'lucide-react';
import { INBOX_LIMITS } from '@gensmart/shared';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import ChoiceList from './ChoiceList';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import { assignSkipFor, groupSkips } from './bulkAssign';
import { changeNote, initialState, labelDelta, nextState, tallyLabels, type TriState } from './bulkLabels';
import { foldText } from './inboxSearch';
import { CLOSE_OUTCOMES, type CloseOutcome, type ConversationRow, type InboxLabel, type TeamMember } from './types';
import styles from './BulkDialogs.module.css';

const NOTE_MAX = 500;

// ── Asignar N ───────────────────────────────────────────────────────────────

export interface BulkAssignDialogProps {
  rows: ConversationRow[];
  userId: string | undefined;
  isManager: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (toUserId: string, note: string) => void;
}

/** "Asignar N conversaciones": nadie viene marcado y el cuadro dice antes cuáles se saltarán. */
export function BulkAssignDialog({ rows, userId, isManager, busy, onCancel, onConfirm }: BulkAssignDialogProps) {
  const { t } = useTranslation();
  const noteId = useId();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get<TeamMember[]>('/api/organization/members')
      .then((list) => {
        if (!alive) return;
        setFailed(false);
        // "(tú)" solo para owner/admin: un miembro no puede asignarse a sí mismo
        setMembers(isManager ? list : list.filter((m) => m.id !== userId));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [userId, isManager, attempt]);

  const team = t('inbox.row.team');
  const skips = rows.map((r) => assignSkipFor(r, choice, userId, isManager, team)).filter((s) => s !== null);
  const groups = groupSkips(skips);
  const willUpdate = rows.length - skips.length;

  return (
    <InboxDialog
      title={t('inbox.bulk.assignTitle', { count: rows.length })}
      onClose={onCancel}
      footer={
        <>
          {!choice && (
            <span id="inbox-bulk-assign-help" className={styles.help}>
              {t('inbox.bulk.pickPerson')}
            </span>
          )}
          <InboxButton onClick={onCancel}>{t('inbox.deleteDialog.cancel')}</InboxButton>
          <InboxButton
            variant="primary"
            onClick={() => choice && onConfirm(choice, note.trim())}
            disabled={!choice || willUpdate === 0}
            aria-describedby={choice ? undefined : 'inbox-bulk-assign-help'}
            loading={busy}
          >
            {t('inbox.bulk.assignConfirm', { count: Math.max(willUpdate, 0) })}
          </InboxButton>
        </>
      }
    >
      {failed ? (
        <div className={styles.state} role="alert">
          <span>{t('inbox.transferDialog.loadError')}</span>
          <InboxButton icon={RefreshCw} onClick={() => setAttempt((n) => n + 1)}>
            {t('inbox.retry')}
          </InboxButton>
        </div>
      ) : members === null ? (
        <div className={styles.state} aria-busy="true">
          {t('inbox.transferDialog.loading')}
        </div>
      ) : members.length === 0 ? (
        <div className={styles.state}>{t('inbox.transferDialog.noTeam')}</div>
      ) : (
        <ChoiceList
          name="inbox-bulk-assign"
          legend={t('inbox.transferDialog.legend')}
          value={choice}
          onChange={setChoice}
          options={members.map((m) => ({
            value: m.id,
            label: `${m.name?.trim() || m.email}${m.id === userId ? ` ${t('inbox.bulk.you')}` : ''}`,
            hint: t(`inbox.transferDialog.roles.${m.role === 'owner' || m.role === 'admin' ? m.role : 'member'}`),
          }))}
        />
      )}
      {groups.length > 0 && (
        <ul className={styles.skips} aria-live="polite">
          {groups.map((g) => (
            <li key={g.key}>{t(`inbox.bulk.skip.${g.kind}`, { count: g.count, name: g.name ?? '' })}</li>
          ))}
        </ul>
      )}
      <label className={styles.field} htmlFor={noteId}>
        <span>{t('inbox.transferDialog.noteLabel')}</span>
        <textarea
          id={noteId}
          rows={3}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('inbox.transferDialog.notePlaceholder')}
          aria-describedby={`${noteId}-count`}
        />
        <small id={`${noteId}-count`} className={styles.count}>
          {t('inbox.transferDialog.noteCount', { n: note.length, max: NOTE_MAX })}
        </small>
      </label>
    </InboxDialog>
  );
}

// ── Cerrar N ────────────────────────────────────────────────────────────────

export interface BulkCloseDialogProps {
  rows: ConversationRow[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (outcome: CloseOutcome) => void;
}

/** "Cerrar N conversaciones": las 4 opciones del cierre, ninguna marcada (no ensucia los Informes). */
export function BulkCloseDialog({ rows, busy, onCancel, onConfirm }: BulkCloseDialogProps) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<CloseOutcome | null>(null);
  const closed = rows.filter((r) => r.status === 'closed').length;
  const open = rows.length - closed;
  return (
    <InboxDialog
      title={t('inbox.bulk.closeTitle', { count: rows.length })}
      onClose={onCancel}
      footer={
        <>
          {!outcome && (
            <span id="inbox-bulk-close-help" className={styles.help}>
              {t('inbox.closeDialog.pickOutcome')}
            </span>
          )}
          <InboxButton onClick={onCancel}>{t('inbox.closeDialog.cancel')}</InboxButton>
          <InboxButton
            variant="primary"
            onClick={() => outcome && onConfirm(outcome)}
            disabled={!outcome || open === 0}
            aria-describedby={outcome ? undefined : 'inbox-bulk-close-help'}
            loading={busy}
          >
            {t('inbox.bulk.closeConfirm', { count: open })}
          </InboxButton>
        </>
      }
    >
      <p>{t('inbox.bulk.closeText', { count: open })}</p>
      <div className={styles.grid}>
        <ChoiceList
          name="inbox-bulk-close"
          legend={t('inbox.closeDialog.outcomeLegend')}
          value={outcome}
          onChange={setOutcome}
          options={CLOSE_OUTCOMES.map((o) => ({ value: o, label: t(`inbox.outcomes.${o}`), hint: t(`inbox.closeDialog.hints.${o}`) }))}
        />
      </div>
      {closed > 0 && <p className={styles.note}>{t('inbox.bulk.alreadyClosed', { count: closed })}</p>}
    </InboxDialog>
  );
}

// ── Etiquetar N ─────────────────────────────────────────────────────────────

export interface BulkLabelDialogProps {
  rows: ConversationRow[];
  catalog: InboxLabel[] | null;
  canCreate: boolean;
  onCreate: (name: string) => Promise<{ label: InboxLabel } | { error: string }>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (add: string[], remove: string[]) => void;
}

/** "Etiquetar N conversaciones": casillas de tres estados. Solo cambia lo que se tocó. */
export function BulkLabelDialog({ rows, catalog, canCreate, onCreate, busy, onCancel, onConfirm }: BulkLabelDialogProps) {
  const { t } = useTranslation();
  const searchRef = useRef<HTMLInputElement>(null);
  const total = rows.length;
  const tally = useMemo(() => tallyLabels(rows.map((r) => (r.labels ?? []).map((l) => l.id))), [rows]);
  const initial = useMemo(() => {
    const m = new Map<string, TriState>();
    for (const l of catalog ?? []) m.set(l.id, initialState(tally.get(l.id) ?? 0, total));
    return m;
  }, [catalog, tally, total]);
  const [states, setStates] = useState<Map<string, TriState>>(new Map());
  const [q, setQ] = useState('');
  const [problem, setProblem] = useState('');
  const stateOf = (id: string): TriState => states.get(id) ?? initial.get(id) ?? 'none';
  const merged = useMemo(() => {
    const m = new Map(initial);
    for (const [k, v] of states) m.set(k, v);
    return m;
  }, [initial, states]);
  const delta = labelDelta(merged, initial);
  const changed = delta.add.length + delta.remove.length > 0;

  const fq = foldText(q.trim());
  const list = (catalog ?? []).filter((l) => !fq || foldText(l.name).includes(fq));
  const exact = (catalog ?? []).some((l) => foldText(l.name) === fq);
  const tooLong = [...q.trim()].length > INBOX_LIMITS.labelNameMaxChars;

  const create = async () => {
    const name = q.trim();
    if (!name || tooLong) return;
    const r = await onCreate(name);
    if ('label' in r) {
      setStates((s) => new Map(s).set(r.label.id, 'all'));
      setQ('');
      setProblem('');
    } else {
      setProblem(r.error === 'label_taken' ? t('inbox.labels.taken') : r.error === 'labels_limit' ? t('inbox.labels.orgLimit') : t('inbox.labels.createError'));
    }
  };

  return (
    <InboxDialog
      title={t('inbox.bulk.labelTitle', { count: total })}
      onClose={onCancel}
      initialFocusRef={searchRef}
      footer={
        <>
          <InboxButton onClick={onCancel}>{t('inbox.deleteDialog.cancel')}</InboxButton>
          <InboxButton variant="primary" onClick={() => onConfirm(delta.add, delta.remove)} disabled={!changed} loading={busy}>
            {t('inbox.bulk.labelConfirm')}
          </InboxButton>
        </>
      }
    >
      <label className={styles.search}>
        <Search size={14} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('inbox.labels.search')}
          aria-label={t('inbox.labels.search')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCreate && q.trim() && !exact) {
              e.preventDefault();
              void create();
            }
          }}
        />
      </label>
      {catalog === null ? (
        <div className={styles.state} aria-busy="true">
          {t('inbox.transferDialog.loading')}
        </div>
      ) : (
        <div className={styles.tri} role="group" aria-label={t('inbox.bulk.labelLegend')}>
          {list.map((l) => {
            const s = stateOf(l.id);
            const from = initial.get(l.id) ?? 'none';
            const count = tally.get(l.id) ?? 0;
            const change = changeNote(s, from, count, total);
            return (
              <button
                key={l.id}
                type="button"
                role="checkbox"
                aria-checked={s === 'all' ? 'true' : s === 'none' ? 'false' : 'mixed'}
                className={styles.triRow}
                onClick={() => setStates((m) => new Map(m).set(l.id, nextState(s, from)))}
              >
                <span className={`${styles.box} ${s !== 'none' ? styles.boxOn : ''}`} aria-hidden="true">
                  {s === 'all' ? <Check size={12} /> : s === 'some' ? <Minus size={12} /> : null}
                </span>
                <span className={styles.triName}>{l.name}</span>
                {change ? (
                  <small className={change.kind === 'add' ? styles.willAdd : styles.willRemove}>
                    {t(change.kind === 'add' ? 'inbox.bulk.willAdd' : 'inbox.bulk.willRemove', { count: change.n })}
                  </small>
                ) : s === 'some' ? (
                  <small className={styles.partial}>{t('inbox.bulk.someOf', { n: count, total })}</small>
                ) : null}
              </button>
            );
          })}
          {list.length === 0 && !q && <p className={styles.note}>{t('inbox.labels.noneYet')}</p>}
        </div>
      )}
      {q.trim() && !exact && canCreate && !tooLong && (
        <button type="button" className={styles.create} onClick={() => void create()}>
          <Plus size={14} aria-hidden="true" />
          {t('inbox.labels.create', { name: q.trim() })}
        </button>
      )}
      {q.trim() && !exact && !canCreate && list.length === 0 && <p className={styles.note}>{t('inbox.labels.askAdmin')}</p>}
      {tooLong && canCreate && <p className={styles.problem}>{t('inbox.labels.tooLong', { max: INBOX_LIMITS.labelNameMaxChars })}</p>}
      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}
      <p className={styles.note}>{t('inbox.bulk.labelLimitNote', { max: INBOX_LIMITS.labelsPerConversation })}</p>
    </InboxDialog>
  );
}
