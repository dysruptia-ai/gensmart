'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { INBOX_LIMITS } from '@gensmart/shared';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import type { InboxLabel } from './types';
import { notifyInboxLabelsChanged, useInboxLabels } from './useInboxLabels';
import styles from './InboxSettings.module.css';

const UNDO_MS = 5000;

function sortLabels(list: InboxLabel[]): InboxLabel[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Ajustes › Etiquetas (web-43, mockup 5). Renombrar en línea; los miembros solo leen. */
export default function LabelsSettings({ isManager }: { isManager: boolean }) {
  const { t, language } = useTranslation();
  const { labels, error, reload, setLabels } = useInboxLabels();
  // Fila en edición: el id, o 'new' para la fila nueva
  const [editing, setEditing] = useState<{ id: string | 'new'; value: string; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<InboxLabel | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ name: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const locale = language === 'es' ? 'es-CO' : 'en-US';

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function errorText(err: unknown): string {
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === 'label_taken') return t('inbox.labels.taken');
    if (code === 'labels_limit') return t('inbox.labels.orgLimit');
    return t('inbox.labels.saveError');
  }

  async function commitEdit() {
    if (!editing || saving) return;
    const name = editing.value.trim();
    if (!name) return setEditing({ ...editing, error: t('inbox.labels.nameRequired') });
    if ([...name].length > INBOX_LIMITS.labelNameMaxChars) {
      return setEditing({ ...editing, error: t('inbox.labels.tooLong', { max: INBOX_LIMITS.labelNameMaxChars }) });
    }
    const current = editing.id === 'new' ? null : labels?.find((l) => l.id === editing.id);
    if (current && current.name === name) return setEditing(null);
    setSaving(true);
    try {
      const r = current
        ? await api.patch<{ label: InboxLabel }>(`/api/inbox-labels/${current.id}`, { name })
        : await api.post<{ label: InboxLabel }>('/api/inbox-labels', { name });
      setLabels((prev) => sortLabels([...(prev ?? []).filter((l) => l.id !== r.label.id), r.label]));
      setEditing(null);
      notifyInboxLabelsChanged();
    } catch (err) {
      setEditing({ ...editing, error: errorText(err) });
    } finally {
      setSaving(false);
    }
  }

  async function remove(label: InboxLabel) {
    setDeleteBusy(true);
    setProblem(null);
    try {
      await api.delete(`/api/inbox-labels/${label.id}`);
      setLabels((prev) => prev?.filter((l) => l.id !== label.id) ?? prev);
      setDeleting(null);
      notifyInboxLabelsChanged();
      // Sin conversaciones no se pregunta: queda "Deshacer" durante 5 s
      if (label.conversationCount === 0) {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndo({ name: label.name });
        undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
      }
    } catch {
      setProblem(t('inbox.labels.deleteError'));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function undoDelete() {
    if (!undo) return;
    const name = undo.name;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    try {
      const r = await api.post<{ label: InboxLabel }>('/api/inbox-labels', { name });
      setLabels((prev) => sortLabels([...(prev ?? []), r.label]));
      notifyInboxLabelsChanged();
    } catch (err) {
      setProblem(errorText(err));
    }
  }

  const editor = (rowId: string | 'new') =>
    editing?.id === rowId ? (
      <span className={styles.inlineEdit}>
        <input
          ref={inputRef}
          className={`${styles.inlineInput} ${editing.error ? styles.invalid : ''}`}
          value={editing.value}
          onChange={(e) => setEditing({ id: rowId, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commitEdit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(null);
            }
          }}
          aria-label={t('inbox.labels.nameLabel')}
          aria-invalid={!!editing.error}
          aria-describedby={`label-edit-help-${rowId}`}
          maxLength={INBOX_LIMITS.labelNameMaxChars + 10}
          disabled={saving}
        />
        <span id={`label-edit-help-${rowId}`} className={editing.error ? styles.error : styles.help} role={editing.error ? 'alert' : undefined}>
          {editing.error ?? t('inbox.labels.editKeys')}
        </span>
      </span>
    ) : null;

  return (
    <section className={`${styles.card} ${styles.cardNarrow}`} aria-labelledby="labels-title">
      <div className={styles.cardHead}>
        <div>
          <h2 id="labels-title" className={styles.cardTitle}>
            {t('inbox.labels.title')}
          </h2>
          <p className={styles.cardText}>{t('inbox.settings.labelsText')}</p>
        </div>
        {isManager && labels && (
          <InboxButton variant="primary" icon={Plus} onClick={() => setEditing({ id: 'new', value: '' })} disabled={editing?.id === 'new'}>
            {t('inbox.labels.new')}
          </InboxButton>
        )}
      </div>

      {undo && (
        <div className={styles.undo} role="status">
          <span>{t('inbox.labels.deleted', { name: undo.name })}</span>
          <InboxButton icon={Undo2} onClick={() => void undoDelete()}>
            {t('inbox.labels.undo')}
          </InboxButton>
        </div>
      )}
      {problem && (
        <p className={styles.error} role="alert">
          {problem}
        </p>
      )}

      {error && !labels ? (
        <p className={styles.empty} role="alert">
          {t('inbox.settings.loadError')}{' '}
          <button type="button" className={styles.linkButton} onClick={reload}>
            {t('inbox.retry')}
          </button>
        </p>
      ) : !labels ? (
        <p className={styles.empty}>{t('inbox.settings.loading')}</p>
      ) : labels.length === 0 && editing?.id !== 'new' ? (
        <div className={styles.emptyBox}>
          <p>{t('inbox.labels.noneYet')}</p>
          {!isManager && <p className={styles.help}>{t('inbox.labels.askAdmin')}</p>}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('inbox.labels.name')}</th>
              <th scope="col" className={styles.num}>
                {t('inbox.labels.conversations')}
              </th>
              {isManager && (
                <th scope="col" className={styles.actionsCol}>
                  <span className="gsSr">{t('inbox.settings.actions')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {editing?.id === 'new' && (
              <tr>
                <td>{editor('new')}</td>
                <td className={styles.num}>0</td>
                {isManager && <td />}
              </tr>
            )}
            {labels.map((label) => (
              <tr key={label.id}>
                <td className={styles.strong}>{editor(label.id) ?? label.name}</td>
                <td className={styles.num}>{label.conversationCount.toLocaleString(locale)}</td>
                {isManager && (
                  <td className={styles.actionsCol}>
                    {editing?.id !== label.id && (
                      <span className={styles.actions}>
                        <InboxButton
                          variant="icon"
                          icon={Pencil}
                          onClick={() => setEditing({ id: label.id, value: label.name })}
                          aria-label={t('inbox.labels.renameAria', { name: label.name })}
                          title={t('inbox.labels.rename')}
                        />
                        <InboxButton
                          variant="icon"
                          icon={Trash2}
                          onClick={() => (label.conversationCount > 0 ? setDeleting(label) : void remove(label))}
                          aria-label={t('inbox.labels.deleteAria', { name: label.name })}
                          title={t('inbox.settings.delete')}
                        />
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {deleting && (
        <InboxDialog
          title={t('inbox.labels.deleteTitle', { name: deleting.name })}
          onClose={() => setDeleting(null)}
          initialFocusRef={cancelRef}
          footer={
            <>
              <InboxButton ref={cancelRef} onClick={() => setDeleting(null)}>
                {t('inbox.settings.cancel')}
              </InboxButton>
              <InboxButton variant="danger" icon={Trash2} onClick={() => void remove(deleting)} loading={deleteBusy}>
                {t('inbox.labels.deleteConfirm')}
              </InboxButton>
            </>
          }
        >
          <p>{t('inbox.labels.deleteText', { count: deleting.conversationCount.toLocaleString(locale) })}</p>
        </InboxDialog>
      )}
    </section>
  );
}
