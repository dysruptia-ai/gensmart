'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldOff, Check, Lock, AlertTriangle, Copy } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import styles from '../settings.module.css';

type TwoFAStep = 'idle' | 'setup' | 'verify' | 'backup';

interface Setup2FAResponse {
  secret: string;
  qrCode: string;
}

interface Enable2FAResponse {
  backupCodes: string[];
}

export default function SecurityPage() {
  const { user, refreshUser } = useAuth();
  const { success, error: toastError } = useToast();
  // We don't have totp_enabled in AuthUser, so we manage local state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [step, setStep] = useState<TwoFAStep>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSetup() {
    setLoading(true);
    try {
      const data = await api.post<Setup2FAResponse>('/api/auth/2fa/setup');
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('setup');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to set up 2FA');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post<Enable2FAResponse>('/api/auth/2fa/enable', { secret, code });
      setBackupCodes(data.backupCodes);
      setStep('backup');
      setTwoFAEnabled(true);
      await refreshUser();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisabling(true);
    try {
      await api.post('/api/auth/2fa/disable', { password: disablePassword });
      setTwoFAEnabled(false);
      setDisableOpen(false);
      setDisablePassword('');
      setStep('idle');
      success('Two-factor authentication disabled');
      await refreshUser();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to disable 2FA');
    } finally {
      setDisabling(false);
    }
  }

  function handleCopyCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function reset() {
    setStep('idle');
    setCode('');
    setQrCode('');
    setSecret('');
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Security</h1>
        <p className={styles.pageDesc}>Manage your account security settings.</p>
      </div>

      {/* 2FA Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Two-Factor Authentication</h2>

        {step === 'idle' && (
          <>
            <div className={styles.twoFAStatus}>
              {twoFAEnabled ? (
                <>
                  <ShieldCheck size={20} color="var(--color-success)" aria-hidden="true" />
                  <Badge variant="success">Enabled</Badge>
                  <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
                    Your account is protected with 2FA.
                  </span>
                </>
              ) : (
                <>
                  <ShieldOff size={20} color="var(--color-text-secondary)" aria-hidden="true" />
                  <Badge variant="neutral">Not enabled</Badge>
                  <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>
                    Add an extra layer of security to your account.
                  </span>
                </>
              )}
            </div>

            {twoFAEnabled ? (
              <Button variant="danger" size="sm" icon={ShieldOff} onClick={() => setDisableOpen(true)}>
                Disable 2FA
              </Button>
            ) : (
              <Button size="sm" icon={ShieldCheck} onClick={handleSetup} loading={loading}>
                Enable 2FA
              </Button>
            )}
          </>
        )}

        {step === 'setup' && (
          <div className={styles.twoFASteps}>
            <div>
              <p className={styles.stepTitle}>Step 1: Scan the QR code</p>
              <div className={styles.qrWrapper}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="2FA QR Code" className={styles.qrImage} />
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
                  Use Google Authenticator, Authy, or any TOTP app.
                </p>
                <div>
                  <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', margin: '0 0 0.25rem', textAlign: 'center' }}>
                    Or enter the code manually:
                  </p>
                  <div className={styles.secretCode}>{secret}</div>
                </div>
              </div>
            </div>

            <div>
              <p className={styles.stepTitle}>Step 2: Enter the 6-digit code</p>
              <form onSubmit={handleEnable} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="Verification Code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    inputMode="numeric"
                    icon={ShieldCheck}
                  />
                </div>
                <Button type="submit" loading={loading}>Verify &amp; Enable</Button>
              </form>
            </div>

            <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
          </div>
        )}

        {step === 'backup' && (
          <div>
            <div className={styles.warningBanner} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '0.125rem' }} aria-hidden="true" />
              <span>Save these backup codes in a secure place. They can each be used once if you lose access to your authenticator.</span>
            </div>
            <div className={styles.backupCodes}>
              {backupCodes.map((c) => (
                <div key={c} className={styles.backupCode}>{c}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={handleCopyCodes}>
                {copied ? 'Copied!' : 'Copy All'}
              </Button>
              <Button size="sm" icon={Check} onClick={reset}>
                I&apos;ve Saved My Backup Codes
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Account Info */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: 'var(--font-sm)' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ color: 'var(--color-text-secondary)', minWidth: '100px' }}>Email</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{user?.email}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ color: 'var(--color-text-secondary)', minWidth: '100px' }}>Role</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>{user?.role}</span>
          </div>
        </div>
      </section>

      {/* Disable 2FA Modal */}
      <Modal
        isOpen={disableOpen}
        onClose={() => { setDisableOpen(false); setDisablePassword(''); }}
        title="Disable Two-Factor Authentication"
        size="sm"
      >
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Enter your password to confirm disabling 2FA.
        </p>
        <form onSubmit={handleDisable} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Password"
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            placeholder="••••••••"
            required
            autoFocus
            icon={Lock}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setDisableOpen(false)}>Cancel</Button>
            <Button variant="danger" type="submit" loading={disabling}>Disable 2FA</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
