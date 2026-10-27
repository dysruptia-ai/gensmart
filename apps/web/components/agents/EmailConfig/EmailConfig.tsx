'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, CheckCircle, Unplug, Copy, Check, Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Toggle from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './EmailConfig.module.css';

type FormFieldSeparator = 'colon' | 'equals' | 'both';

interface EmailStatus {
  connected: boolean;
  inboundAddress: string;
  replyFromName: string;
  signature: string;
  autoReplyEnabled: boolean;
  autoReplyText: string;
  formFieldSeparator: FormFieldSeparator;
  channelEnabled: boolean;
  serverConfigured: boolean;
}

interface EmailConfigProps {
  agentId: string;
  orgPlan: string;
}

const FREE_PLAN_PLANS = ['free'];
const MAX_AUTO_REPLY = 2000;
const MAX_SIGNATURE = 1000;

export default function EmailConfig({ agentId, orgPlan }: EmailConfigProps) {
  const { success, error: toastError } = useToast();
  const { t } = useTranslation();
  const tm = (key: string, values?: Record<string, string | number>) => t('agents.channels.emailConfig.' + key, values);

  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replyFromName, setReplyFromName] = useState('');
  const [signature, setSignature] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyText, setAutoReplyText] = useState('');
  const [formFieldSeparator, setFormFieldSeparator] = useState<FormFieldSeparator>('colon');
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const isFreePlan = FREE_PLAN_PLANS.includes(orgPlan);
  const autoReplyMissing = autoReplyEnabled && autoReplyText.trim().length === 0;

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<EmailStatus>(`/api/email/status/${agentId}`);
      setStatus(data);
      setReplyFromName(data.replyFromName);
      setSignature(data.signature);
      setAutoReplyEnabled(data.autoReplyEnabled);
      setAutoReplyText(data.autoReplyText);
      setFormFieldSeparator(data.formFieldSeparator ?? 'colon');
    } catch {
      // Non-critical — the address is derivable, but without status we cannot show a state
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!isFreePlan) loadStatus();
    else setLoading(false);
  }, [loadStatus, isFreePlan]);

  function errorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'PLAN_LIMIT':
          return tm('errors.planLimit');
        case 'NOT_CONFIGURED':
          return tm('errors.notConfigured');
        default:
          return err.message || tm('errors.generic');
      }
    }
    return tm('errors.generic');
  }

  async function handleCopy() {
    if (!status) return;
    try {
      await navigator.clipboard.writeText(status.inboundAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError(tm('errors.copyFailed'));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (autoReplyMissing || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/api/email/connect', {
        agentId,
        replyFromName: replyFromName.trim(),
        signature,
        autoReplyEnabled,
        autoReplyText: autoReplyText.trim(),
        formFieldSeparator,
      });
      success(status?.connected ? tm('toast.saved') : tm('toast.connected'));
      setTouched(false);
      await loadStatus();
    } catch (err) {
      const msg = errorMessage(err);
      setFormError(msg);
      toastError(msg);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm(tm('toast.disconnectConfirm'))) return;
    setDisconnecting(true);
    try {
      await api.post('/api/email/disconnect', { agentId });
      success(tm('toast.disconnected'));
      await loadStatus();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : tm('toast.disconnectFailed'));
    } finally {
      setDisconnecting(false);
    }
  }

  // Free plan gate
  if (isFreePlan) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateIcon}>
          <Mail size={28} color="var(--color-text-secondary)" aria-hidden="true" />
        </div>
        <div className={styles.gateText}>
          <div className={styles.gateTitle}>{tm('gateTitle')}</div>
          <p className={styles.gateDesc}>{tm('gateDesc')}</p>
        </div>
        <Button size="sm" onClick={() => window.open('/pricing', '_blank')}>
          {tm('upgrade')}
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spinner />
      </div>
    );
  }

  if (!status) {
    return <div className={styles.errorBox} role="alert">{tm('errors.generic')}</div>;
  }

  return (
    <div className={styles.layout}>
      <div className={styles.column}>
        {/* Connection status */}
        <div className={styles.statusRow}>
          <div className={styles.statusLabel}>
            <Mail size={16} aria-hidden="true" />
            {tm('statusLabel')}
          </div>
          <Badge variant={status.connected ? 'success' : 'neutral'} size="sm">
            {status.connected ? tm('connected') : tm('notConnected')}
          </Badge>
        </div>

        {!status.serverConfigured && (
          <div className={styles.errorBox} role="alert">{tm('errors.notConfigured')}</div>
        )}

        {/* Agent address + forwarding instructions */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{tm('addressLabel')}</div>
          <div className={styles.addressRow}>
            <code className={styles.address}>{status.inboundAddress}</code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={handleCopy}
            >
              {copied ? tm('copied') : tm('copy')}
            </Button>
          </div>
          <p className={styles.fieldHint}>{tm('addressHint')}</p>

          <div className={styles.useCases}>
            <div className={styles.useCase}>
              <div className={styles.useCaseTitle}>{tm('useCaseDirectTitle')}</div>
              <p className={styles.fieldHint}>{tm('useCaseDirectDesc')}</p>
            </div>
            <div className={styles.useCase}>
              <div className={styles.useCaseTitle}>{tm('useCaseFormTitle')}</div>
              <p className={styles.fieldHint}>{tm('useCaseFormDesc')}</p>
            </div>
          </div>

          <div className={styles.sectionTitle}>{tm('howTitle')}</div>
          <ol className={styles.steps}>
            <li>{tm('step1')}</li>
            <li>{tm('step2')}</li>
            <li>{tm('step3')}</li>
          </ol>
        </div>
      </div>

      {/* Settings */}
      <div className={styles.column}>
        <form className={styles.section} onSubmit={handleSave} noValidate>
          <div className={styles.sectionTitle}>{tm('settingsTitle')}</div>

          <Input
            id={`email-from-name-${agentId}`}
            label={tm('fromNameLabel')}
            placeholder={tm('fromNamePlaceholder')}
            value={replyFromName}
            onChange={(e) => setReplyFromName(e.target.value)}
            hint={tm('fromNameHint')}
            maxLength={60}
            disabled={saving}
          />

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`email-signature-${agentId}`}>{tm('signatureLabel')}</label>
            <textarea
              id={`email-signature-${agentId}`}
              className={styles.textarea}
              rows={4}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={tm('signaturePlaceholder')}
              maxLength={MAX_SIGNATURE}
              disabled={saving}
            />
            <span className={styles.fieldHint}>{tm('signatureHint')}</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`email-form-separator-${agentId}`}>
              {tm('formSeparatorLabel')}
            </label>
            <select
              id={`email-form-separator-${agentId}`}
              className={styles.select}
              value={formFieldSeparator}
              onChange={(e) => setFormFieldSeparator(e.target.value as FormFieldSeparator)}
              disabled={saving}
            >
              <option value="colon">{tm('formSeparatorColon')}</option>
              <option value="equals">{tm('formSeparatorEquals')}</option>
              <option value="both">{tm('formSeparatorBoth')}</option>
            </select>
            <span className={styles.fieldHint}>{tm('formSeparatorHint')}</span>
          </div>

          <div className={styles.toggleRow}>
            <div>
              <div className={styles.label}>{tm('autoReplyLabel')}</div>
              <span className={styles.fieldHint}>{tm('autoReplyHint')}</span>
            </div>
            <Toggle checked={autoReplyEnabled} onChange={setAutoReplyEnabled} disabled={saving} />
          </div>

          {autoReplyEnabled && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`email-autoreply-${agentId}`}>{tm('autoReplyTextLabel')}</label>
              <textarea
                id={`email-autoreply-${agentId}`}
                className={styles.textarea}
                rows={4}
                value={autoReplyText}
                onChange={(e) => setAutoReplyText(e.target.value)}
                placeholder={tm('autoReplyTextPlaceholder')}
                maxLength={MAX_AUTO_REPLY}
                disabled={saving}
                aria-invalid={touched && autoReplyMissing}
              />
              {touched && autoReplyMissing && (
                <span className={styles.fieldError}>{tm('validation.autoReplyRequired')}</span>
              )}
            </div>
          )}

          {formError && <div className={styles.errorBox} role="alert">{formError}</div>}

          <div className={styles.actions}>
            <Button
              type="submit"
              size="sm"
              icon={status.connected ? Save : CheckCircle}
              loading={saving}
              disabled={!status.serverConfigured}
            >
              {status.connected ? tm('saveButton') : tm('activateButton')}
            </Button>
            {status.connected && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={Unplug}
                onClick={handleDisconnect}
                loading={disconnecting}
              >
                {tm('disconnectButton')}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
