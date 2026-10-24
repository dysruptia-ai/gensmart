'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, CheckCircle, Unplug, KeyRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './TelegramConfig.module.css';

interface TelegramStatus {
  connected: boolean;
  botId: string | null;
  botUsername: string | null;
  maskedToken: string | null;
  webhookUrl: string | null;
  channelEnabled: boolean;
}

interface ConnectResponse {
  success: boolean;
  botUsername: string | null;
  botId: string;
  maskedToken: string;
  webhookUrl: string;
}

interface TelegramConfigProps {
  agentId: string;
}

// <bot id>:<secret>, e.g. 123456789:AAH... — UX hint only, the backend validates against Telegram.
const BOT_TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;

const DISCONNECTED_STATUS: TelegramStatus = {
  connected: false,
  botId: null,
  botUsername: null,
  maskedToken: null,
  webhookUrl: null,
  channelEnabled: false,
};

export default function TelegramConfig({ agentId }: TelegramConfigProps) {
  const { success, error: toastError } = useToast();
  const { t } = useTranslation();
  const tm = (key: string, values?: Record<string, string | number>) => t('agents.channels.telegramConfig.' + key, values);

  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [touched, setTouched] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const trimmedToken = botToken.trim();
  const formatInvalid = trimmedToken.length > 0 && !BOT_TOKEN_PATTERN.test(trimmedToken);
  const fieldError = touched && trimmedToken.length === 0
    ? tm('validation.required')
    : touched && formatInvalid
      ? tm('validation.format')
      : undefined;

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TelegramStatus>(`/api/telegram/status/${agentId}`);
      setStatus(data);
    } catch {
      // Non-critical — show not connected
      setStatus(DISCONNECTED_STATUS);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  function errorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'INVALID_BOT_TOKEN':
          return tm('errors.invalidBotToken');
        case 'BOT_ALREADY_CONNECTED':
          return tm('errors.botAlreadyConnected');
        case 'TELEGRAM_UNAVAILABLE':
          return tm('errors.telegramUnavailable');
        case 'WEBHOOK_SET_FAILED':
          return tm('errors.webhookSetFailed');
        case 'NOT_CONFIGURED':
          return tm('errors.notConfigured');
        default:
          return err.message || tm('errors.generic');
      }
    }
    return tm('errors.generic');
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!trimmedToken || formatInvalid) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setConnecting(true);
    setConnectError(null);
    try {
      const data = await api.post<ConnectResponse>('/api/telegram/connect', { agentId, botToken: trimmedToken });
      // Drop the token from memory as soon as it is stored server-side
      setBotToken('');
      setTouched(false);
      success(tm('toast.connected', { bot: data.botUsername ? '@' + data.botUsername : data.botId }));
      await loadStatus();
    } catch (err) {
      const msg = errorMessage(err);
      setConnectError(msg);
      toastError(msg);
    } finally {
      submittingRef.current = false;
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm(tm('toast.disconnectConfirm'))) {
      return;
    }
    setDisconnecting(true);
    try {
      await api.post('/api/telegram/disconnect', { agentId });
      success(tm('toast.disconnected'));
      await loadStatus();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : tm('toast.disconnectFailed'));
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Connection status */}
      <div className={styles.statusRow}>
        <div className={styles.statusLabel}>
          <Send size={16} aria-hidden="true" />
          {tm('statusLabel')}
        </div>
        <Badge variant={status?.connected ? 'success' : 'neutral'} size="sm">
          {status?.connected ? tm('connected') : tm('notConnected')}
        </Badge>
      </div>

      {/* Connected */}
      {status?.connected && (
        <div className={styles.section}>
          {(status.botUsername || status.botId) && (
            <div className={styles.connectedInfo}>
              <CheckCircle size={14} color="var(--color-success)" aria-hidden="true" />
              <span>{tm('botInfo')}: <strong>{status.botUsername ? `@${status.botUsername}` : status.botId}</strong></span>
            </div>
          )}
          {status.maskedToken && (
            <div className={styles.connectedInfo}>
              <KeyRound size={14} aria-hidden="true" />
              <span>{tm('tokenInfo')}: <span className={styles.maskedToken}>{status.maskedToken}</span></span>
            </div>
          )}
          <Button
            variant="danger"
            size="sm"
            icon={Unplug}
            onClick={handleDisconnect}
            loading={disconnecting}
          >
            {tm('disconnectButton')}
          </Button>
        </div>
      )}

      {/* Not connected */}
      {!status?.connected && (
        <form className={styles.section} onSubmit={handleConnect} noValidate>
          <div className={styles.sectionTitle}>{tm('setupTitle')}</div>
          <p className={styles.fieldHint}>{tm('setupDesc')}</p>
          <Input
            id={`telegram-bot-token-${agentId}`}
            type="password"
            label={tm('tokenLabel')}
            placeholder={tm('tokenPlaceholder')}
            value={botToken}
            onChange={(e) => {
              setBotToken(e.target.value);
              if (connectError) setConnectError(null);
            }}
            onBlur={() => { if (botToken) setTouched(true); }}
            error={fieldError}
            hint={tm('tokenHint')}
            disabled={connecting}
            autoComplete="off"
            spellCheck={false}
          />
          {connectError && (
            <div className={styles.errorBox} role="alert">{connectError}</div>
          )}
          <div>
            <Button
              type="submit"
              size="sm"
              icon={Send}
              loading={connecting}
              disabled={!trimmedToken}
            >
              {tm('connectButton')}
            </Button>
          </div>
          {connecting && (
            <div className={styles.progress}>
              <Spinner size="sm" />
              <span>{tm('steps.connecting')}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
