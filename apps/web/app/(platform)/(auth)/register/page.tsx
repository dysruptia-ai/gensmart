'use client';

import React, { Suspense, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Tag, X } from 'lucide-react';
import { signupRefSchema } from '@gensmart/shared';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { appSiteHref } from '@/lib/app-links';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AppButton,
  AppTurnstile,
  Checkbox,
  Notice,
  PasswordField,
  PasswordRules,
  TextButton,
  TextField,
  passwordIsValid,
} from '@/components/app';
import { AuthHeading, AuthIcon, useAuthScreen } from '@/components/auth';
import { EMAIL_RE, isNetworkError, isRateLimited } from '@/components/auth/authForm';
import s from '@/components/auth/auth-screens.module.css';

const SELF_SERVICE_PLANS = { solo: 'Solo', starter: 'Starter', pro: 'Pro' } as const;
type SelfServicePlan = keyof typeof SELF_SERVICE_PLANS;

function isPlan(value: string | null): value is SelfServicePlan {
  return value !== null && value in SELF_SERVICE_PLANS;
}

type FieldKey = 'name' | 'email' | 'org' | 'password' | 'captcha' | 'terms';
type FieldErrors = Partial<Record<FieldKey, string>>;

function RegisterScreen() {
  const searchParams = useSearchParams();
  // `?ref=` (socios): se manda sin mostrarlo, solo para atribución (si no cumple el formato, no se manda)
  const refParsed = signupRefSchema.safeParse(searchParams.get('ref') ?? '');
  const ref = refParsed.success ? refParsed.data : undefined;
  const codeFromUrl = (searchParams.get('code') ?? '').trim();
  const planParam = searchParams.get('plan');
  const plan = isPlan(planParam) ? planParam : undefined;
  const { register } = useAuth();
  const { t, language } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [password, setPassword] = useState('');
  const [promo, setPromo] = useState(codeFromUrl);
  const [promoOpen, setPromoOpen] = useState(codeFromUrl !== '');
  const [promoFromLink, setPromoFromLink] = useState(codeFromUrl !== '');
  const [terms, setTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<'' | 'generic' | 'network' | 'limit'>('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ email: string; promoApplied: boolean } | null>(null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const orgRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const promoRef = useRef<HTMLInputElement>(null);
  const captchaRef = useRef<HTMLDivElement>(null);

  useAuthScreen({
    title: done ? t('access.checkEmail.title') : t('access.meta.register'),
    panel: done ? null : 'register',
  });

  function focusField(key: FieldKey) {
    const targets = { name: nameRef, email: emailRef, org: orgRef, password: passwordRef, terms: termsRef };
    if (key === 'captcha') captchaRef.current?.scrollIntoView({ block: 'center' });
    else targets[key].current?.focus();
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    const n = name.trim();
    const o = org.trim();
    if (n.length < 2) e.name = t('access.register.eName');
    else if (n.length > 100) e.name = t('access.register.eNameLong');
    if (!EMAIL_RE.test(email.trim())) e.email = t('access.errors.email');
    if (o.length < 2) e.org = t('access.register.eOrg');
    else if (o.length > 255) e.org = t('access.register.eOrgLong');
    if (!passwordIsValid(password)) e.password = t('access.register.ePassword');
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) e.captcha = t('access.register.eCaptcha');
    if (!terms) e.terms = t('access.register.eTerms');
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setFormError('');
    const first = (['name', 'email', 'org', 'password', 'captcha', 'terms'] as FieldKey[]).find((k) => e[k]);
    if (first) {
      focusField(first);
      return;
    }

    setLoading(true);
    const promoCode = promoOpen ? promo.trim() : '';
    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        organizationName: org.trim(),
        password,
        turnstileToken,
        promoCode: promoCode || undefined,
        plan,
        acceptTerms: terms,
        language,
        ref,
      });
      setDone({ email: result.email, promoApplied: Boolean(promoCode) && result.promoApplied });
      setLoading(false);
      return;
    } catch (err) {
      const next: FieldErrors = {};
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') next.email = t('access.register.eTaken');
      else if (err instanceof ApiError && err.code === 'ORG_SLUG_TAKEN') next.org = t('access.register.eOrgTaken');
      else if (err instanceof ApiError && err.code === 'CAPTCHA_FAILED') next.captcha = t('access.register.eCaptchaFailed');
      else if (isRateLimited(err)) setFormError('limit');
      else setFormError(isNetworkError(err) ? 'network' : 'generic');
      setErrors(next);
      const firstApi = (['email', 'org', 'captcha'] as FieldKey[]).find((k) => next[k]);
      if (firstApi) focusField(firstApi);
      // Un token de Turnstile sirve una sola vez: después de cada intento fallido se pide otro
      setTurnstileReset((n) => n + 1);
    }
    setLoading(false);
  }

  async function handleResend() {
    if (!done) return;
    setResend('sending');
    try {
      await api.post('/api/auth/resend-verification', { email: done.email });
      setResend('sent');
    } catch {
      setResend('idle');
    }
  }

  function removePromo() {
    setPromo('');
    setPromoFromLink(false);
    setPromoOpen(false);
  }

  if (done) {
    return (
      <>
        <AuthIcon icon={Mail} />
        <AuthHeading
          key="sent"
          title={t('access.checkEmail.title')}
          subtitle={
            <>
              {t('access.checkEmail.sentTo')} <span className={s.email}>{done.email}</span>. {t('access.checkEmail.activate')}
            </>
          }
        />
        {done.promoApplied && <Notice kind="success">{t('access.checkEmail.promo')}</Notice>}
        {resend === 'sent' && <Notice kind="success">{t('access.checkEmail.resent')}</Notice>}
        <AppButton variant="secondary" onClick={handleResend} loading={resend === 'sending'}>
          {t('access.checkEmail.resend')}
        </AppButton>
        <p className={s.hint}>{t('access.checkEmail.hint')}</p>
        <p className={s.alt}>
          <TextButton
            onClick={() => {
              setDone(null);
              setResend('idle');
              setPassword('');
              setTerms(false);
              setTurnstileReset((n) => n + 1);
            }}
          >
            {t('access.checkEmail.other')}
          </TextButton>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthHeading key="form" title={t('access.register.title')} subtitle={t('access.register.subtitle')} />
      {plan && <p className={s.chip}>{t('access.register.planSelected', { plan: SELF_SERVICE_PLANS[plan] })}</p>}
      {formError === 'limit' && <Notice kind="error">{t('access.register.eLimit')}</Notice>}
      {formError === 'generic' && <Notice kind="error">{t('access.errors.generic')}</Notice>}
      {formError === 'network' && <Notice kind="error">{t('access.errors.network')}</Notice>}

      {/* web-38: "Continuar con Google" y el divisor "o con tu correo" van aquí */}

      <form onSubmit={handleSubmit} noValidate>
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
          label={t('access.field.email')}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('access.field.emailPh')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          inputRef={emailRef}
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
        <PasswordField
          label={t('access.register.password')}
          name="new-password"
          autoComplete="new-password"
          placeholder={t('access.register.passwordPh')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          inputRef={passwordRef}
          describedBy="pw-rules"
          showLabel={t('access.field.show')}
          hideLabel={t('access.field.hide')}
          showAria={t('access.field.showPassword')}
          hideAria={t('access.field.hidePassword')}
          required
        />
        <PasswordRules
          id="pw-rules"
          password={password}
          label={t('access.register.rulesLabel')}
          rules={{
            length: t('access.register.rule8'),
            upper: t('access.register.ruleUpper'),
            number: t('access.register.ruleNumber'),
          }}
          metLabel={t('access.register.ruleMet')}
          unmetLabel={t('access.register.ruleUnmet')}
        />

        {promoOpen ? (
          <>
            <TextField
              label={t('access.register.promo')}
              name="promo-code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={t('access.register.promoPh')}
              value={promo}
              onChange={(e) => {
                setPromo(e.target.value);
                if (e.target.value.trim() !== codeFromUrl) setPromoFromLink(false);
              }}
              inputRef={promoRef}
              maxLength={100}
              className={promoFromLink ? s.promoWithChip : undefined}
            />
            {promoFromLink && promo.trim() !== '' && (
              <p className={s.chip}>
                <Tag size={14} aria-hidden="true" />
                {t('access.register.promoApplied')}
                <button type="button" onClick={removePromo} aria-label={t('access.register.promoRemove')}>
                  <X size={14} aria-hidden="true" />
                </button>
              </p>
            )}
          </>
        ) : (
          <p className={s.promoRow}>
            <TextButton
              onClick={() => {
                setPromoOpen(true);
                requestAnimationFrame(() => promoRef.current?.focus());
              }}
            >
              {t('access.register.promoLink')}
            </TextButton>
          </p>
        )}

        <div ref={captchaRef}>
          <AppTurnstile
            onToken={setTurnstileToken}
            resetKey={turnstileReset}
            language={language}
            label={t('access.register.captcha')}
            error={errors.captcha}
            errorId="captcha-error"
          />
        </div>

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
          {t('access.register.submit')}
        </AppButton>
      </form>

      <p className={s.alt}>
        {t('access.register.haveAccount')} <Link href="/login">{t('access.register.login')}</Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterScreen />
    </Suspense>
  );
}
