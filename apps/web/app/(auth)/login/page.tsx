'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import styles from '../auth.module.css';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, verify2FA } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = searchParams.get('from') ?? '/dashboard';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requires2FA && result.tempToken) {
        setTempToken(result.tempToken);
      } else {
        router.replace(from);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verify2FA(tempToken!, totpCode);
      router.replace(from);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (tempToken) {
    return (
      <div className={styles.container}>
        <div className={styles.logoCenter}>
          <Logo size="lg" href="/" />
        </div>

        <div className={styles.twoFAWrapper}>
          <ShieldCheck size={40} color="var(--color-primary)" aria-hidden="true" />
          <h2 className={styles.twoFATitle} style={{ marginTop: '0.75rem' }}>
            Two-Factor Authentication
          </h2>
          <p className={styles.twoFADesc}>
            Enter the 6-digit code from your authenticator app or a backup code.
          </p>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </div>
        )}

        <form onSubmit={handle2FA} className={styles.form}>
          <Input
            label="Authentication Code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            placeholder="000000"
            maxLength={8}
            autoComplete="one-time-code"
            autoFocus
            icon={ShieldCheck}
          />
          <Button type="submit" fullWidth loading={loading}>
            Verify
          </Button>
        </form>

        <div className={styles.footer}>
          <button
            className={styles.backLink}
            onClick={() => { setTempToken(null); setTotpCode(''); setError(''); }}
          >
            <ArrowLeft size={14} /> Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoCenter}>
        <Logo size="lg" href="/" />
      </div>

      <h1 className={styles.heading}>Sign in to your account</h1>
      <p className={styles.subheading}>Welcome back! Enter your credentials to continue.</p>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className={styles.form}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
          icon={Mail}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          icon={Lock}
        />
        <Link href="/forgot-password" className={styles.forgotLink}>
          Forgot password?
        </Link>
        <Button type="submit" fullWidth loading={loading}>
          Sign In
        </Button>
      </form>

      <p className={styles.footer}>
        Don&apos;t have an account?{' '}
        <Link href="/register">Create one</Link>
      </p>
    </div>
  );
}
