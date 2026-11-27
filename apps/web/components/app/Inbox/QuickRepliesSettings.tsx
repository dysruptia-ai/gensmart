'use client';

import React, { useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import QuickReplyEditor from './QuickReplyEditor';
import type { QuickReply } from './quickReplies';
import { notifyQuickRepliesChanged, useQuickReplies } from './useQuickReplies';
import styles from './InboxSettings.module.css';

/** Ajustes › Respuestas rápidas (web-43, mockup 4). Los miembros solo leen. */
export default function QuickRepliesSettings({ isManager }: { isManager: boolean }) {
  const { t, language } = useTranslation();
  const { replies, error, reload, setReplies } = useQuickReplies();
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null);
  const [deleting, setDeleting] = useState<QuickReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const locale = language === 'es' ? 'es-CO' : 'en-US';

  function saved(reply: QuickReply) {
    setReplies((prev) => {
      const list = prev ?? [];
      const exists = list.some((r) => r.id === reply.id);
      const next = exists ? list.map((r) => (r.id === reply.id ? reply : r)) : [...list, reply];
      return next.sort((a, b) => b.useCount - a.useCount || a.shortcut.localeCompare(b.shortcut));
    });
    setEditing(null);
    notifyQuickRepliesChanged();
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setProblem(null);
    try {
      await api.delete(`/api/quick-replies/${deleting.id}`);
      setReplies((prev) => prev?.filter((r) => r.id !== deleting.id) ?? prev);
      notifyQuickRepliesChanged();
      setDeleting(null);
    } catch {
      setProblem(t('inbox.settings.qr.deleteError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${styles.card} ${styles.cardWide}`} aria-labelledby="qr-title">
      <div className={styles.cardHead}>
        <div>
          <h2 id="qr-title" className={styles.cardTitle}>
            {t('inbox.settings.qr.title')}
          </h2>
          <p className={styles.cardText}>{t('inbox.settings.qr.text')}</p>
        </div>
        {isManager && (replies?.length ?? 0) > 0 && (
          <InboxButton variant="primary" icon={Plus} onClick={() => setEditing('new')}>
            {t('inbox.settings.qr.new')}
          </InboxButton>
        )}
      </div>

      {error && !replies ? (
        <p className={styles.empty} role="alert">
          {t('inbox.settings.loadError')}{' '}
          <button type="button" className={styles.linkButton} onClick={reload}>
            {t('inbox.retry')}
          </button>
        </p>
      ) : !replies ? (
        <p className={styles.empty}>{t('inbox.settings.loading')}</p>
      ) : replies.length === 0 ? (
        <div className={styles.emptyBox}>
          <p>{t('inbox.quickReplies.empty')}</p>
          {isManager ? (
            <InboxButton variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              {t('inbox.settings.qr.new')}
            </InboxButton>
          ) : (
            <p className={styles.help}>{t('inbox.quickReplies.askAdmin')}</p>
          )}
        </div>
      ) : (
        <table className={`${styles.table} ${styles.stack}`}>
          <thead>
            <tr>
              <th scope="col">{t('inbox.settings.qr.shortcut')}</th>
              <th scope="col">{t('inbox.settings.qr.body')}</th>
              <th scope="col" className={styles.num}>
                {t('inbox.settings.qr.uses')}
              </th>
              {isManager && (
                <th scope="col" className={styles.actionsCol}>
                  <span className="gsSr">{t('inbox.settings.actions')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {replies.map((r) => (
              <tr key={r.id}>
                <td className={styles.strong} data-label={t('inbox.settings.qr.shortcut')}>
                  /{r.shortcut}
                </td>
                <td data-label={t('inbox.settings.qr.body')}>
                  <span className={styles.clamp} title={r.body}>
                    {r.body}
                  </span>
                </td>
                <td className={styles.num} data-label={t('inbox.settings.qr.uses')}>
                  {r.useCount.toLocaleString(locale)}
                </td>
                {isManager && (
                  <td className={styles.actionsCol}>
                    <span className={styles.actions}>
                      <InboxButton variant="icon" icon={Pencil} onClick={() => setEditing(r)} aria-label={t('inbox.settings.qr.editAria', { shortcut: r.shortcut })} title={t('inbox.settings.edit')} />
                      <InboxButton variant="icon" icon={Trash2} onClick={() => setDeleting(r)} aria-label={t('inbox.settings.qr.deleteAria', { shortcut: r.shortcut })} title={t('inbox.settings.delete')} />
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && <QuickReplyEditor reply={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />}

      {deleting && (
        <InboxDialog
          title={t('inbox.settings.qr.deleteTitle', { shortcut: deleting.shortcut })}
          onClose={() => setDeleting(null)}
          initialFocusRef={cancelRef}
          footer={
            <>
              <InboxButton ref={cancelRef} onClick={() => setDeleting(null)}>
                {t('inbox.settings.cancel')}
              </InboxButton>
              <InboxButton variant="danger" icon={Trash2} onClick={() => void remove()} loading={busy}>
                {t('inbox.settings.delete')}
              </InboxButton>
            </>
          }
        >
          <p>{t('inbox.settings.qr.deleteText')}</p>
          {problem && (
            <p className={styles.error} role="alert">
              {problem}
            </p>
          )}
        </InboxDialog>
      )}
    </section>
  );
}
