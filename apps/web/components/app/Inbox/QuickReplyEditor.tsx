'use client';

import React, { useRef, useState } from 'react';
import { INBOX_LIMITS, QUICK_REPLY_SHORTCUT_RE } from '@gensmart/shared';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import { applyReplyVariablesParts, type QuickReply } from './quickReplies';
import styles from './InboxSettings.module.css';

export interface QuickReplyEditorProps {
  /** null = nueva. */
  reply: QuickReply | null;
  onClose: () => void;
  onSaved: (reply: QuickReply) => void;
}

/** Crear o editar una respuesta rápida (web-43, mockup 4). Solo owner y admin. */
export default function QuickReplyEditor({ reply, onClose, onSaved }: QuickReplyEditorProps) {
  const { t, language } = useTranslation();
  const [shortcut, setShortcut] = useState(reply?.shortcut ?? '');
  const [body, setBody] = useState(reply?.body ?? '');
  const [errors, setErrors] = useState<{ shortcut?: string; body?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const shortcutRef = useRef<HTMLInputElement>(null);

  const normalized = shortcut.trim().replace(/^\/+/, '').toLowerCase();
  const length = [...body].length;
  const locale = language === 'es' ? 'es-CO' : 'en-US';

  function insertVariable(token: string) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    const next: typeof errors = {};
    if (!QUICK_REPLY_SHORTCUT_RE.test(normalized)) next.shortcut = t('inbox.settings.qr.shortcutInvalid');
    if (!body.trim()) next.body = t('inbox.settings.qr.bodyRequired');
    else if (length > INBOX_LIMITS.quickReplyMaxChars) next.body = t('inbox.settings.qr.bodyTooLong');
    setErrors(next);
    if (next.shortcut) return shortcutRef.current?.focus();
    if (next.body) return bodyRef.current?.focus();
    setSaving(true);
    try {
      const payload = { shortcut: normalized, body };
      const r = reply
        ? await api.patch<{ quickReply: QuickReply }>(`/api/quick-replies/${reply.id}`, payload)
        : await api.post<{ quickReply: QuickReply }>('/api/quick-replies', payload);
      onSaved(r.quickReply);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'shortcut_taken') {
        setErrors({ shortcut: t('inbox.settings.qr.shortcutTaken') });
        shortcutRef.current?.focus();
      } else if (code === 'quick_replies_limit') {
        setErrors({ form: t('inbox.settings.qr.limit', { max: INBOX_LIMITS.quickRepliesPerOrg }) });
      } else {
        setErrors({ form: t('inbox.settings.qr.saveError') });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <InboxDialog
      title={reply ? t('inbox.settings.qr.editTitle') : t('inbox.settings.qr.newTitle')}
      onClose={onClose}
      initialFocusRef={shortcutRef}
      footer={
        <>
          <InboxButton onClick={onClose}>{t('inbox.settings.cancel')}</InboxButton>
          <InboxButton variant="primary" onClick={() => void save()} loading={saving}>
            {t('inbox.settings.save')}
          </InboxButton>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className={styles.field}>
          <label htmlFor="qr-shortcut">{t('inbox.settings.qr.shortcut')}</label>
          <span className={`${styles.prefixed} ${errors.shortcut ? styles.invalid : ''}`}>
            <span className={styles.prefix} aria-hidden="true">
              /
            </span>
            <input
              id="qr-shortcut"
              ref={shortcutRef}
              value={shortcut}
              onChange={(e) => {
                setShortcut(e.target.value.replace(/\s/g, '').replace(/^\/+/, ''));
                setErrors((x) => ({ ...x, shortcut: undefined }));
              }}
              placeholder={t('inbox.settings.qr.shortcutPlaceholder')}
              maxLength={30}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!errors.shortcut}
              aria-describedby="qr-shortcut-help"
            />
          </span>
          <span id="qr-shortcut-help" className={errors.shortcut ? styles.error : styles.help} role={errors.shortcut ? 'alert' : undefined}>
            {errors.shortcut ?? t('inbox.settings.qr.shortcutHelp')}
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor="qr-body">{t('inbox.settings.qr.body')}</label>
          <textarea
            id="qr-body"
            ref={bodyRef}
            className={`${styles.textarea} ${errors.body ? styles.invalid : ''}`}
            rows={4}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setErrors((x) => ({ ...x, body: undefined }));
            }}
            placeholder={t('inbox.settings.qr.bodyPlaceholder')}
            aria-invalid={!!errors.body}
            aria-describedby="qr-body-help"
          />
          <span className={styles.row}>
            <span className={styles.inserts}>
              {t('inbox.settings.qr.insert')}
              <button type="button" className={styles.insert} onClick={() => insertVariable('{nombre}')}>
                {'{nombre}'}
              </button>
              <button type="button" className={styles.insert} onClick={() => insertVariable('{agente}')}>
                {'{agente}'}
              </button>
            </span>
            <span className={`${styles.counter} ${length > INBOX_LIMITS.quickReplyMaxChars ? styles.over : ''}`}>
              {length.toLocaleString(locale)} / {INBOX_LIMITS.quickReplyMaxChars.toLocaleString(locale)}
            </span>
          </span>
          <span id="qr-body-help" className={errors.body ? styles.error : styles.help} role={errors.body ? 'alert' : undefined}>
            {errors.body ?? t('inbox.settings.qr.variablesHelp')}
          </span>
        </div>

        {body.trim() && (
          <div className={styles.previewBox}>
            <span className={styles.previewLabel}>{t('inbox.settings.qr.preview')}</span>
            <p className={styles.previewText}>
              {applyReplyVariablesParts(body, { contactName: t('inbox.settings.qr.sampleName'), agentName: t('inbox.settings.qr.sampleAgent') }).map((p, i) =>
                p.variable === 'contact' ? (
                  <mark key={i} className={styles.value}>
                    {p.text}
                  </mark>
                ) : (
                  <React.Fragment key={i}>{p.text}</React.Fragment>
                ),
              )}
            </p>
          </div>
        )}
        {errors.form && (
          <p className={styles.error} role="alert">
            {errors.form}
          </p>
        )}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </InboxDialog>
  );
}
