'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AlertCircle, Mail, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../../auth.module.css';

export default function OrgAccessPage() {
  const router = useRouter();
  const params = useParams();
  const token = params['token'] as string;
  const { t } = useTranslation();
  const { refreshUser } = useAuth();

  const [status, setStatus] = useState<'loading' | 'invalid'>('loading');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const attempted = useRef(false);

  async function handleResend() {
    setResendState('sending');
    try {
      // Always the same generic response regardless of what happened
      // server-side (unknown token, rate-limited, user no longer a member) —
      // this endpoint must never confirm whether a given org/token exists.
      await api.post(`/api/auth/org-access/${token}/resend`);
    } catch {
      // Even a network/5xx error still shows the generic "sent" state —
      // nothing here should differ from the happy path.
    } finally {
      setResendState('sent');
    }
  }

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        // Sets the httpOnly refresh_token cookie server-side; the response
        // body itself is not used here — refreshUser() below reuses the
        // exact same session bootstrap as the silent-refresh-on-mount flow
        // (AuthContext), instead of duplicating it.
        await api.post('/api/auth/org-access/consume', { token });
        await refreshUser();
        router.replace('/dashboard');
      } catch {
        setStatus('invalid');
      }
    })();
  }, [token, refreshUser, router]);

  if (status === 'loading') {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div className={styles.logoCenter}>
          <Logo size="lg" href="/" />
        </div>
        <Spinner size="lg" />
        <p className={styles.subheading} style={{ marginTop: '1rem' }}>
          {t('auth.orgAccess.loading')}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoCenter}>
        <Logo size="lg" href="/" />
      </div>

      <h1 className={styles.heading}>{t('auth.orgAccess.invalidTitle')}</h1>
      <p className={styles.subheading}>{t('auth.orgAccess.invalidSubtitle')}</p>

      <div className={styles.errorBanner} role="alert">
        <AlertCircle size={14} aria-hidden="true" />
        {t('auth.orgAccess.invalidTitle')}
      </div>

      {resendState === 'sent' ? (
        <div className={styles.successBanner} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <CheckCircle2 size={16} />
          {t('auth.orgAccess.resendSuccess')}
        </div>
      ) : (
        <Button
          fullWidth
          variant="secondary"
          icon={RefreshCw}
          loading={resendState === 'sending'}
          onClick={handleResend}
          style={{ marginTop: '1rem' }}
        >
          {t('auth.orgAccess.resendButton')}
        </Button>
      )}

      <a
        href="mailto:hello@gensmart.co"
        className={styles.form}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none', marginTop: '1rem' }}
      >
        <Mail size={16} />
        {t('auth.orgAccess.contactSupport')}
      </a>

      <p className={styles.footer}>
        <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <ArrowLeft size={14} /> {t('auth.orgAccess.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
