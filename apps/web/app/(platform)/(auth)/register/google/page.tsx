'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LinkIcon, Tag, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { appSiteHref } from '@/lib/app-links';
import { useTranslation } from '@/hooks/useTranslation';
import { AppButton, Checkbox, Notice, TextField } from '@/components/app';
import { AuthHeading, AuthIcon, useAuthScreen } from '@/components/auth';
import { useOAuthReturn } from '@/components/auth/useOAuthReturn';
import { afterLoginHref, isNetworkError, isRateLimited, safeFrom } from '@/components/auth/authForm';
import s from '@/components/auth/auth-screens.module.css';

const SELF_SERVICE_PLANS: Record<string, string> = { solo: 'Solo', starter: 'Starter', pro: 'Pro' };

interface PendingSignup {
  email: string;
  name: string;
  plan?: string;
  code?: string;
  lang: 'es' | 'en';
  intent: 'login' | 'register';
}

type FieldKey = 'name' | 'org' | 'terms';
type FieldErrors = Partial<Record<FieldKey, string>>;

/**
 * Completar el registro con Google (web-38). Google ya verificó el correo: no se pide contraseña
 * ni captcha. El token de la URL es de un solo uso y vence a los 15 minutos.
 */
function GoogleSignupScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('t') ?? '';
  const noAccount = searchParams.get('nouser') === '1';
  useOAuthReturn(searchParams);
  const { completeOAuthSignup } = useAuth();
  const { t, language } = useTranslation();

  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'expired' | 'error'>(token ? 'loading' : 'expired');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [terms, setTerms] = useState(false);
  const [promo, setPromo] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<'' | 'generic' | 'network' | 'limit' | 'taken'>('');
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const orgRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  useAuthScreen({
    title: t('access.oauth.complete.title'),
    panel: status === 'ready' ? 'register' : null,
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<PendingSignup>(`/api/auth/oauth/signup/${encodeURIComponent(token)}`)
      .then((p) => {
        if (cancelled) return;
        setPending(p);
        setName(p.name);
        setPromo(p.code ?? '');
        setStatus('ready');
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof ApiError ? 'expired' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    const n = name.trim();
    const o = org.trim();
    if (n.length < 2) e.name = t('access.register.eName');
    else if (n.length > 100) e.name = t('access.register.eNameLong');
    if (o.length < 2) e.org = t('access.register.eOrg');
    else if (o.length > 255) e.org = t('access.register.eOrgLong');
    if (!terms) e.terms = t('access.register.eTerms');
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setFormError('');
    const first = (['name', 'org', 'terms'] as FieldKey[]).find((k) => e[k]);
    if (first) {
      ({ name: nameRef, org: orgRef, terms: termsRef })[first].current?.focus();
      return;
    }
    setLoading(true);
    try {
      const { user, from } = await completeOAuthSignup({
        token,
        name: name.trim(),
        organizationName: org.trim(),
        acceptTerms: terms,
        promoCode: promo.trim() || undefined,
        language,
      });
      router.replace(afterLoginHref(safeFrom(from), user.welcomeSurvey));
      return;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ORG_SLUG_TAKEN') {
        setErrors({ org: t('access.register.eOrgTaken') });
        orgRef.current?.focus();
      } else if (err instanceof ApiError && err.code === 'SIGNUP_EXPIRED') {
        setStatus('expired');
      } else if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setFormError('taken');
      } else if (isRateLimited(err)) {
        setFormError('limit');
      } else {
        setFormError(isNetworkError(err) ? 'network' : 'generic');
      }
    }
    setLoading(false);
  }

  if (status === 'loading') {
    return (
      <>
        <AuthHeading key="loading" title={t('access.oauth.complete.title')} />
        <p className={s.loadingBox} role="status">
          <span className={s.spinner} aria-hidden="true" />
          {t('access.oauth.complete.loading')}
        </p>
      </>
    );
  }

  if (status !== 'ready' || !pending) {
    return (
      <>
        <AuthIcon icon={LinkIcon} tone="err" />
        <AuthHeading key="expired" title={t('access.oauth.complete.title')} />
        <Notice kind="error">
          {status === 'error' ? t('access.errors.network') : t('access.oauth.complete.expired')}
        </Notice>
        <p className={s.alt}>
          <Link href="/register">{t('access.oauth.complete.retry')}</Link>
        </p>
      </>
    );
  }

  const planLabel = pending.plan ? SELF_SERVICE_PLANS[pending.plan] : undefined;

  return (
    <>
      <AuthHeading key="form" title={t('access.oauth.complete.title')} subtitle={t('access.oauth.complete.subtitle')} />
      {noAccount && <Notice kind="info">{t('access.oauth.complete.noAccount')}</Notice>}
      {planLabel && <p className={s.chip}>{t('access.register.planSelected', { plan: planLabel })}</p>}
      {formError === 'limit' && <Notice kind="error">{t('access.register.eLimit')}</Notice>}
      {formError === 'taken' && <Notice kind="error">{t('access.register.eTaken')}</Notice>}
      {formError === 'generic' && <Notice kind="error">{t('access.errors.generic')}</Notice>}
      {formError === 'network' && <Notice kind="error">{t('access.errors.network')}</Notice>}

      <form onSubmit={handleSubmit} noValidate>
        <TextField
          label={t('access.oauth.complete.email')}
          type="email"
          name="email"
          value={pending.email}
          readOnly
          aria-readonly="true"
          help={t('access.oauth.complete.emailHelp')}
        />
        <TextField
          label={t('access.register.name')}
          name="name"
          autoComplete="name"
          placeholder={t('access.register.namePh')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          inputRef={nameRef}
          maxLength={100}
          required
        />
        <TextField
          label={t('access.register.org')}
          name="organization"
          autoComplete="organization"
          placeholder={t('access.register.orgPh')}
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          error={errors.org}
          inputRef={orgRef}
          maxLength={255}
          required
        />

        {promo !== '' && (
          <p className={s.chip}>
            <Tag size={14} aria-hidden="true" />
            {t('access.register.promoApplied')}
            <button type="button" onClick={() => setPromo('')} aria-label={t('access.register.promoRemove')}>
              <X size={14} aria-hidden="true" />
            </button>
          </p>
        )}

        <Checkbox
          name="accept-terms"
          checked={terms}
          onChange={(e) => {
            setTerms(e.target.checked);
            if (e.target.checked) setErrors((prev) => ({ ...prev, terms: undefined }));
          }}
          error={errors.terms}
          inputRef={termsRef}
          required
        >
          {t('access.register.termsBefore')}
          <a href={appSiteHref('terms', language)} target="_blank" rel="noopener">
            {t('access.register.termsLink')}
          </a>
          {t('access.register.termsMiddle')}
          <a href={appSiteHref('privacy', language)} target="_blank" rel="noopener">
            {t('access.register.privacyLink')}
          </a>
          {t('access.register.termsAfter')}
        </Checkbox>

        <AppButton type="submit" loading={loading}>
          {t('access.oauth.complete.submit')}
        </AppButton>
      </form>

      <p className={s.alt}>
        {t('access.register.haveAccount')} <Link href="/login">{t('access.register.login')}</Link>
      </p>
    </>
  );
}

export default function GoogleSignupPage() {
  return (
    <Suspense fallback={null}>
      <GoogleSignupScreen />
    </Suspense>
  );
}
