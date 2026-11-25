'use client';

import { useId, useState, type FormEvent } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../Container';
import Section from '../Section';
import styles from './NewsletterBand.module.css';

/**
 * MÓDULO PENDIENTE: la suscripción a la newsletter todavía no tiene backend.
 * El diseño la "confirmaba" sin enviar nada (`data-endpoint=""`); aquí, mientras el
 * endpoint sea `null`, el envío muestra el error genérico y nunca dice "quedaste suscrito".
 * Cuando exista el servicio, solo hay que poner su URL (POST JSON `{ email, language }`).
 */
const NEWSLETTER_ENDPOINT: string | null = null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = 'idle' | 'invalid' | 'sending' | 'error' | 'ok';

/** Banda de suscripción del blog (design/web: `newsletter`). */
export default function NewsletterBand() {
  const { t, language } = useSiteTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const inputId = useId();
  const msgId = useId();

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setStatus('invalid');
      return;
    }
    setStatus('sending');
    if (!NEWSLETTER_ENDPOINT) {
      // Sin servicio todavía: no se finge la suscripción
      setStatus('error');
      return;
    }
    try {
      const res = await fetch(NEWSLETTER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), language }),
      });
      setStatus(res.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const message =
    status === 'invalid'
      ? t('site.blog.newsletter.invalid')
      : status === 'error'
        ? t('site.blog.newsletter.error')
        : status === 'ok'
          ? t('site.blog.newsletter.ok')
          : '';
  const isError = status === 'invalid' || status === 'error';

  return (
    <Section surface="alt" rhythm="m">
      <Container className={styles.band}>
        <div className={styles.copy}>
          <h2 id={`${inputId}-h`} className={styles.title}>
            {t('site.blog.newsletter.title')}
          </h2>
          <p className={styles.lead}>{t('site.blog.newsletter.lead')}</p>
        </div>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.srOnly} htmlFor={inputId}>
            {t('site.blog.newsletter.label')}
          </label>
          <input
            id={inputId}
            className={styles.input}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t('site.blog.newsletter.placeholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status !== 'idle' && status !== 'sending') setStatus('idle');
            }}
            aria-invalid={status === 'invalid' ? true : undefined}
            aria-describedby={message ? msgId : undefined}
          />
          <button className={styles.button} type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? t('site.blog.newsletter.sending') : t('site.blog.newsletter.submit')}
          </button>
          <p id={msgId} className={`${styles.msg} ${isError ? styles.err : styles.ok}`} role="status" aria-live="polite">
            {message}
          </p>
        </form>
      </Container>
    </Section>
  );
}
