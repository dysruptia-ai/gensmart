'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { isSiteLanguage } from '@/lib/site-routes';
import CheckList from '../../CheckList';
import Container from '../../Container';
import Section from '../../Section';
import SiteLink from '../../SiteLink';
import TurnstileField, { TURNSTILE_SITE_KEY } from '../../TurnstileField';
import { SITE_TRIAL_DAYS } from '../../siteTrial';
import {
  CONTACT_CHECK_COUNT,
  CONTACT_NEXT_COUNT,
  type ContactFormType,
  type ContactVariant,
} from '../contactData';
import styles from './ContactFormSection.module.css';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';
const C = 'site.contact';
const F = `${C}.form`;

type FieldName = 'name' | 'email' | 'whatsapp' | 'message';
type FieldErrors = Partial<Record<FieldName, string>>;
type Status = 'idle' | 'sending' | 'success' | 'networkError';

const FIELD_ORDER: readonly FieldName[] = ['name', 'email', 'whatsapp', 'message'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_RE = /^[0-9+\-() ]*$/;

interface Values {
  name: string;
  email: string;
  whatsapp: string;
  message: string;
}

const EMPTY: Values = { name: '', email: '', whatsapp: '', message: '' };

interface ContactFormSectionProps {
  variant: ContactVariant | null;
}

export default function ContactFormSection({ variant }: ContactFormSectionProps) {
  const { t, language } = useTranslation();
  const lang = isSiteLanguage(language) ? language : 'en';
  const id = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [token, setToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);

  const V = variant ? `${C}.tipos.${variant}` : null;
  const type: ContactFormType = variant ?? 'demo';
  const days = { days: SITE_TRIAL_DAYS };
  const variantTitle = V ? t(`${V}.title`) : null;

  // Título de la pestaña en la variante (el canonical sigue sin query). Next vuelve a pintar
  // el <title> de los metadatos al hidratar, así que se reaplica si lo cambia.
  useEffect(() => {
    if (!variantTitle) return;
    const apply = () => {
      if (document.title !== variantTitle) document.title = variantTitle;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [variantTitle]);

  const fieldId = (name: FieldName) => `${id}-${name}`;
  const errorId = (name: FieldName) => `${id}-${name}-error`;

  function validate(v: Values): FieldErrors {
    const out: FieldErrors = {};
    if (!v.name.trim()) out.name = t(`${F}.errors.nameRequired`);
    if (!v.email.trim()) out.email = t(`${F}.errors.emailRequired`);
    else if (!EMAIL_RE.test(v.email.trim())) out.email = t(`${F}.errors.emailInvalid`);
    if (v.whatsapp.trim() && (!WHATSAPP_RE.test(v.whatsapp.trim()) || v.whatsapp.trim().length > 40)) {
      out.whatsapp = t(`${F}.errors.whatsappInvalid`);
    }
    if (!v.message.trim()) out.message = t(`${F}.errors.messageRequired`);
    return out;
  }

  function update(name: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    // El error de un campo se quita cuando se corrige; no se agregan errores nuevos al escribir
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        if (!validate({ ...values, [name]: value })[name]) delete next[name];
        return next;
      });
    }
  }

  async function send() {
    setStatus('sending');
    setFormError('');
    try {
      const res = await fetch(`${API_BASE}/api/contact-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          whatsapp: values.whatsapp.trim() || undefined,
          message: values.message.trim(),
          type,
          language: lang,
          turnstileToken: token || undefined,
          website: trap,
        }),
      });
      if (res.ok) {
        setStatus('success');
        setValues(EMPTY);
        setCaptchaReset((n) => n + 1);
        return;
      }
      // Respuesta del servidor: no es un fallo de red, no se ofrece reintento automático
      const data = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      setCaptchaReset((n) => n + 1);
      setStatus('idle');
      if (res.status === 429) setFormError(t(`${F}.errors.rateLimited`));
      else if (data?.error?.code === 'CAPTCHA_FAILED') setFormError(t(`${F}.errors.captcha`));
      else setStatus('networkError');
    } catch {
      setCaptchaReset((n) => n + 1);
      setStatus('networkError');
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    const found = validate(values);
    setErrors(found);
    const first = FIELD_ORDER.find((name) => found[name]);
    if (first) {
      setStatus('idle');
      setFormError('');
      document.getElementById(fieldId(first))?.focus();
      return;
    }
    if (TURNSTILE_SITE_KEY && !token) {
      setStatus('idle');
      setFormError(t(`${F}.errors.captcha`));
      return;
    }
    void send();
  }

  function fieldProps(name: FieldName) {
    const invalid = Boolean(errors[name]);
    return {
      id: fieldId(name),
      name,
      value: values[name],
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? errorId(name) : undefined,
      className: `${styles.input} ${invalid ? styles.invalid : ''}`,
    };
  }

  function fieldError(name: FieldName) {
    const message = errors[name];
    return message ? (
      <p id={errorId(name)} className={styles.fieldError}>
        <AlertCircle size={14} aria-hidden="true" />
        {message}
      </p>
    ) : null;
  }

  const required = (
    <span className={styles.req} aria-hidden="true">
      {' *'}
    </span>
  );
  const requiredSr = <span className={styles.srOnly}> ({t(`${F}.required`)})</span>;
  const checks = Array.from({ length: CONTACT_CHECK_COUNT }, (_, i) =>
    t(V ? `${V}.checks.${i}` : `${C}.intro.checks.${i}`, days)
  );
  const errorCount = Object.keys(errors).length;

  return (
    <Section surface="dark" rhythm="m">
      <Container className={styles.split}>
        <div className={styles.intro}>
          <h2 className={styles.title}>{t(V ? `${V}.h2` : `${C}.intro.title`)}</h2>
          <CheckList items={checks} size="md" />
          <div className={styles.next}>
            <h3 className={styles.nextTitle}>{t(`${C}.intro.nextTitle`)}</h3>
            <ol className={styles.steps}>
              {Array.from({ length: CONTACT_NEXT_COUNT }, (_, i) => (
                <li key={i} className={styles.step}>
                  <span className={styles.stepNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{t(`${C}.intro.next.${i}`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <form
          className={styles.form}
          method="post"
          noValidate
          aria-label={t(`${F}.label`)}
          onSubmit={handleSubmit}
        >
          <p className={styles.requiredNote}>{t(`${F}.requiredNote`)}</p>

          <div className={styles.field}>
            <label htmlFor={fieldId('name')} className={styles.label}>
              {t(`${F}.name`)}
              {required}
              {requiredSr}
            </label>
            <input
              {...fieldProps('name')}
              type="text"
              autoComplete="name"
              required
              maxLength={200}
              onChange={(e) => update('name', e.target.value)}
            />
            {fieldError('name')}
          </div>

          <div className={styles.field}>
            <label htmlFor={fieldId('email')} className={styles.label}>
              {t(`${F}.email`)}
              {required}
              {requiredSr}
            </label>
            <input
              {...fieldProps('email')}
              type="email"
              autoComplete="email"
              required
              maxLength={300}
              onChange={(e) => update('email', e.target.value)}
            />
            {fieldError('email')}
          </div>

          <div className={styles.field}>
            <label htmlFor={fieldId('whatsapp')} className={styles.label}>
              {t(`${F}.whatsapp`)} <span className={styles.optional}>({t(`${F}.optional`)})</span>
            </label>
            <input
              {...fieldProps('whatsapp')}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              onChange={(e) => update('whatsapp', e.target.value)}
            />
            {fieldError('whatsapp')}
          </div>

          <div className={styles.field}>
            <label htmlFor={fieldId('message')} className={styles.label}>
              {t(V ? `${V}.msg` : `${F}.message`)}
              {required}
              {requiredSr}
            </label>
            <textarea
              {...fieldProps('message')}
              rows={4}
              required
              maxLength={5000}
              placeholder={V ? undefined : t(`${F}.messagePlaceholder`)}
              onChange={(e) => update('message', e.target.value)}
            />
            {fieldError('message')}
          </div>

          {/* Trampa para bots: fuera de la vista, del teclado y del árbol de accesibilidad */}
          <div className={styles.trap} aria-hidden="true">
            <label htmlFor={`${id}-website`}>{t(`${F}.honeypot`)}</label>
            <input
              id={`${id}-website`}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </div>
          <input type="hidden" name="type" value={type} />

          <TurnstileField
            onToken={setToken}
            resetKey={captchaReset}
            language={lang}
            className={styles.captcha}
          />

          <button type="submit" className={styles.submit} disabled={status === 'sending'}>
            {status === 'sending' ? t(`${F}.sending`) : t(`${F}.send`)}
          </button>

          <p className={styles.legal}>
            {t(`${F}.legalBefore`)}{' '}
            <SiteLink to="legalPrivacy" className={styles.legalLink}>
              {t(`${F}.legalLink`)}
            </SiteLink>
            .
          </p>

          {/* Resumen anunciado: éxito, error de red (con reintento) y errores de validación */}
          <div className={styles.live} role="status" aria-live="polite">
            {status === 'success' ? (
              <p className={styles.success}>
                <CheckCircle2 size={18} aria-hidden="true" />
                {t(`${F}.success`)}
              </p>
            ) : null}
            {status === 'idle' && formError ? <p className={styles.error}>{formError}</p> : null}
            {status === 'idle' && !formError && errorCount > 0 ? (
              <p className={styles.srOnly}>{t(`${F}.summary`, { count: errorCount })}</p>
            ) : null}
          </div>
          <div role="alert" className={styles.live}>
            {status === 'networkError' ? (
              <div className={styles.networkError}>
                <p className={styles.error}>{t(`${F}.networkError`)}</p>
                <button type="button" className={styles.retry} onClick={() => void send()}>
                  <RotateCcw size={14} aria-hidden="true" />
                  {t(`${F}.retry`)}
                </button>
              </div>
            ) : null}
          </div>
        </form>
      </Container>
    </Section>
  );
}
