'use client';

import { useId, useState, type FormEvent } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { DOC_FEEDBACK_COMMENT_MAX, DOC_FEEDBACK_REASONS, type DocFeedbackReason, type DocId } from '@gensmart/shared';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import styles from './DocFeedback.module.css';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';

type Phase = 'ask' | 'form' | 'sending' | 'done';
type SendError = 'reason' | 'send' | 'rate' | null;

interface DocFeedbackProps {
  page: DocId;
  /** Id del `h2`: lo enlaza "¿Te resultó útil?" de la columna "En esta página". */
  headingId: string;
}

/**
 * "¿Te resultó útil esta guía?" (design/web: `dxFeedback`). Envía a POST /api/docs-feedback
 * `{ page, language, helpful, reason?, comment? }`; el "Gracias" solo aparece si el envío salió bien.
 */
export default function DocFeedback({ page, headingId }: DocFeedbackProps) {
  const { t, language } = useSiteTranslation();
  const [phase, setPhase] = useState<Phase>('ask');
  const [reason, setReason] = useState<DocFeedbackReason | null>(null);
  const [comment, setComment] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState<SendError>(null);
  const [lastHelpful, setLastHelpful] = useState<boolean | null>(null);
  const uid = useId();
  const F = 'site.docs.feedback';

  const send = async (helpful: boolean) => {
    setLastHelpful(helpful);
    setError(null);
    setPhase('sending');
    const body: Record<string, unknown> = { page, language, helpful, website: honeypot };
    if (!helpful) {
      body['reason'] = reason;
      if (comment.trim()) body['comment'] = comment.trim();
    }
    try {
      const res = await fetch(`${API_BASE}/api/docs-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(res.status === 429 ? 'rate' : 'send');
        setPhase(helpful ? 'ask' : 'form');
        return;
      }
      setPhase('done');
    } catch {
      setError('send');
      setPhase(helpful ? 'ask' : 'form');
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reason) {
      setError('reason');
      return;
    }
    void send(false);
  };

  const errorText =
    error === 'reason' ? t(`${F}.errReason`) : error === 'rate' ? t(`${F}.errRate`) : error === 'send' ? t(`${F}.errSend`) : '';
  const commentHint = `${uid}-hint`;
  const showForm = phase === 'form' || (phase === 'sending' && lastHelpful === false);

  return (
    <section className={styles.feedback} aria-labelledby={headingId}>
      <div className={styles.ask}>
        <h2 id={headingId}>{t(`${F}.title`)}</h2>
        {phase !== 'done' && !showForm ? (
              <div className={styles.buttons}>
                <button type="button" className={styles.choice} onClick={() => void send(true)} disabled={phase === 'sending'}>
                  <ThumbsUp size={16} aria-hidden="true" /> {t(`${F}.yes`)}
                </button>
                <button
                  type="button"
                  className={styles.choice}
                  onClick={() => {
                    setError(null);
                    setPhase('form');
                  }}
                  disabled={phase === 'sending'}
                >
                  <ThumbsDown size={16} aria-hidden="true" /> {t(`${F}.no`)}
                </button>
              </div>
        ) : null}
      </div>

      <p className={styles.done} role="status">
        {phase === 'done' ? (
          <>
            <strong>{t(`${F}.thanks`)}</strong> {t(`${F}.thanksDesc`)}
          </>
        ) : null}
      </p>

      {showForm ? (
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <fieldset aria-describedby={error === 'reason' ? `${uid}-err` : undefined}>
                <legend>{t(`${F}.legend`)}</legend>
                {DOC_FEEDBACK_REASONS.map((r) => (
                  <label key={r} className={styles.reason}>
                    <input
                      type="radio"
                      name={`${uid}-reason`}
                      value={r}
                      checked={reason === r}
                      onChange={() => {
                        setReason(r);
                        if (error === 'reason') setError(null);
                      }}
                    />
                    <span>
                      <b>{t(`${F}.reasons.${r}.title`)}</b>
                      <small>{t(`${F}.reasons.${r}.desc`)}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className={styles.comment}>
                <span>{t(`${F}.comment`)}</span>
                <textarea
                  rows={3}
                  maxLength={DOC_FEEDBACK_COMMENT_MAX}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  aria-describedby={commentHint}
                />
              </label>
              <p id={commentHint} className={styles.hint}>
                {t(`${F}.privacy`)}{' '}
                <span>{t(`${F}.count`, { n: comment.length, max: DOC_FEEDBACK_COMMENT_MAX })}</span>
              </p>
              {/* Trampa para bots: oculta para las personas */}
              <div className={styles.trap} aria-hidden="true">
                <label>
                  {t(`${F}.honeypot`)}
                  <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </label>
              </div>
              <div className={styles.actions}>
                <button type="submit" className={styles.submit} disabled={phase === 'sending'}>
                  {phase === 'sending' ? t(`${F}.sending`) : t(`${F}.send`)}
                </button>
                <button
                  type="button"
                  className={styles.cancel}
                  onClick={() => {
                    setError(null);
                    setPhase('ask');
                  }}
                >
                  {t(`${F}.cancel`)}
                </button>
              </div>
            </form>
      ) : null}

      <p id={`${uid}-err`} className={styles.error} role="alert">
        {errorText}
      </p>
    </section>
  );
}
