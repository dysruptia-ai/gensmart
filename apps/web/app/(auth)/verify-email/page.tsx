'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../auth.module.css';

type VerifyStatus = 'loading' | 'success' | 'invalid';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useTranslation();

  const [status, setStatus] = useState<VerifyStatus>(token ? 'loading' : 'invalid');
  // The token is single-use: guard against the double effect run in React strict mode
  const attempted = useRef(false);

  const verify = useCallback(async () => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    setStatus('loading');
    try {
      await api.post('/api/auth/verify-email', { token });
      setStatus('success');
    } catch {
      setStatus('invalid');
    }
  }, [token]);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void verify();
  }, [verify]);

  if (status === 'loading') {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div className={styles.logoCenter}>
          <Logo size="lg" href="/" />
        </div>
        <Spinner size="lg" />
        <p className={styles.subheading} style={{ marginTop: '1rem' }}>
          {t('auth.verifyEmail.loading')}
        </p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className={styles.container}>
        <div className={styles.logoCenter}>
          <Logo size="lg" href="/" />
        </div>

        <h1 className={styles.heading}>{t('auth.verifyEmail.successTitle')}</h1>
        <p className={styles.subheading}>{t('auth.verifyEmail.successSubtitle')}</p>

        <div
          className={styles.successBanner}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {t('auth.verifyEmail.successTitle')}
        </div>

        <Link href="/dashboard" style={{ display: 'block', marginTop: '1rem' }}>
          <Button fullWidth variant="primary">
            {t('auth.verifyEmail.goToDashboard')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoCenter}>
        <Logo size="lg" href="/" />
      </div>

      <h1 className={styles.heading}>{t('auth.verifyEmail.invalidTitle')}</h1>
      <p className={styles.subheading}>{t('auth.verifyEmail.invalidSubtitle')}</p>

      <div className={styles.errorBanner} role="alert">
        <AlertCircle size={14} aria-hidden="true" />
        {t('auth.verifyEmail.invalidTitle')}
      </div>

      {token && (
        <Button
          fullWidth
          variant="secondary"
          icon={RefreshCw}
          onClick={() => void verify()}
          style={{ marginTop: '1rem' }}
        >
          {t('auth.verifyEmail.retry')}
        </Button>
      )}

      <a
        href="mailto:hello@gensmart.co"
        className={styles.form}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none', marginTop: '1rem' }}
      >
        <Mail size={16} />
        {t('auth.verifyEmail.contactSupport')}
      </a>

      <p className={styles.footer}>
        <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <ArrowLeft size={14} /> {t('auth.verifyEmail.backToLogin')}
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
