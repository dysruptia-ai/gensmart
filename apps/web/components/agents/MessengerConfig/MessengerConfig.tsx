'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, CheckCircle, Unplug } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import { fbLoginEmbeddedSignup } from '../WhatsAppConfig/fbLogin';
import styles from './MessengerConfig.module.css';

interface MessengerStatus {
  connected: boolean;
  pageId: string | null;
  pageName: string | null;
  webhookUrl: string | null;
  channelEnabled: boolean;
}

interface PageOption {
  id: string;
  name: string;
}

interface SignupResponse {
  success: boolean;
  requiresSelection?: 'page';
  options?: PageOption[];
  signupSessionId?: string;
  pageId?: string;
  pageName?: string;
}

interface MessengerConfigProps {
  agentId: string;
  orgPlan: string;
}

const FREE_PLAN_PLANS = ['free'];

export default function MessengerConfig({ agentId, orgPlan }: MessengerConfigProps) {
  const { success, error: toastError } = useToast();
  const { t } = useTranslation();
  const tm = (key: string, values?: Record<string, string | number>) => t('agents.channels.messengerConfig.' + key, values);

  const [status, setStatus] = useState<MessengerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [signupStep, setSignupStep] = useState<string | null>(null);
  const [selectionOptions, setSelectionOptions] = useState<PageOption[]>([]);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  const isFreePlan = FREE_PLAN_PLANS.includes(orgPlan);
  const fbAppId = process.env['NEXT_PUBLIC_FACEBOOK_APP_ID'];
  const configId = process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID_MESSENGER'];
  const hasSignup = !!fbAppId && !!configId;

  // Load Facebook SDK when component mounts. Same script id as WhatsAppConfig, so when both are
  // mounted on the Channels tab the SDK is only inserted (and initialised) once.
  useEffect(() => {
    if (!fbAppId) return;
    if (document.getElementById('facebook-jssdk')) return;

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.onload = () => {
      const FB = (window as Window & { FB?: {
        init: (opts: Record<string, unknown>) => void;
      } }).FB;
      FB?.init({
        appId: fbAppId,
        cookie: true,
        xfbml: false,
        version: 'v26.0',
      });
    };
    document.head.appendChild(script);
  }, [fbAppId]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<MessengerStatus>(`/api/messenger/status/${agentId}`);
      setStatus(data);
    } catch {
      // Non-critical — show not connected
      setStatus({ connected: false, pageId: null, pageName: null, webhookUrl: null, channelEnabled: false });
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  function resetSelection() {
    setSelectionOptions([]);
    setPendingSessionId(null);
  }

  async function handleDisconnect() {
    if (!window.confirm(tm('toast.disconnectConfirm'))) {
      return;
    }
    setDisconnecting(true);
    try {
      await api.delete(`/api/messenger/disconnect/${agentId}`);
      success(tm('toast.disconnected'));
      await loadStatus();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : tm('toast.disconnectFailed'));
    } finally {
      setDisconnecting(false);
    }
  }

  function handleSignupError(err: unknown) {
    setSignupStep(null);
    const button = tm('connectMessenger');
    let msg = tm('errors.generic');
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'NO_PAGES_FOUND':
          msg = tm('errors.noPages');
          break;
        case 'PAGE_LIST_FAILED':
          msg = tm('errors.pageListFailed');
          break;
        case 'SIGNUP_SESSION_EXPIRED':
          resetSelection();
          msg = tm('errors.sessionExpired', { button });
          break;
        case 'SIGNUP_SESSION_UNAVAILABLE':
          msg = tm('errors.sessionUnavailable');
          break;
        case 'PLAN_LIMIT':
          msg = tm('errors.planLimit');
          break;
        case 'PAGE_ALREADY_CONNECTED':
          msg = tm('errors.pageAlreadyConnected');
          break;
        case 'INVALID_SELECTION':
          resetSelection();
          msg = tm('errors.invalidSelection', { button });
          break;
        case 'INVALID_FB_TOKEN':
          msg = tm('errors.invalidFbToken', { button });
          break;
        case 'CODE_EXCHANGE_FAILED':
          msg = tm('errors.codeExchangeFailed', { button });
          break;
        case 'WEBHOOK_SUBSCRIBE_FAILED':
          msg = tm('errors.webhookSubscribeFailed', { button });
          break;
        case 'NOT_CONFIGURED':
          msg = tm('errors.notConfigured');
          break;
        default:
          msg = err.message;
      }
    }
    toastError(msg);
  }

  // Shared by the first call (fbCode) and the page re-selection call (signupSessionId + selectedPageId)
  function submitSignup(body: Record<string, string>) {
    api.post<SignupResponse>('/api/messenger/embedded-signup-complete', body)
      .then(function(data) {
        if (data.requiresSelection === 'page') {
          setSignupStep(null);
          setSelectionOptions(data.options ?? []);
          setPendingSessionId(data.signupSessionId ?? null);
          return;
        }
        resetSelection();
        success(tm('toast.signupConnected', { page: data.pageName ?? data.pageId ?? '' }));
        return loadStatus();
      })
      .catch(handleSignupError)
      .finally(function() {
        setConnecting(false);
        setSignupStep(null);
      });
  }

  function handleConnect() {
    if (!hasSignup) return;

    const FB = (window as Window & { FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
    } }).FB;

    if (!FB) {
      toastError(tm('toast.sdkNotLoaded'));
      return;
    }

    // Plain callbacks only: the SDK scans this closure for the forbidden keyword.
    fbLoginEmbeddedSignup(FB, configId as string, function(code) {
      if (!code) {
        toastError(tm('toast.abortGeneric', { button: tm('connectMessenger') }));
        return;
      }
      setConnecting(true);
      setSignupStep(tm('steps.connecting'));
      submitSignup({ agentId, fbCode: code });
    });
  }

  function handleSelectionContinue(pageId: string) {
    if (!pendingSessionId) return;

    setConnecting(true);
    setSignupStep(tm('steps.connectingPage'));
    const sessionId = pendingSessionId;
    setSelectionOptions([]);
    submitSignup({ agentId, signupSessionId: sessionId, selectedPageId: pageId });
  }

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spinner />
      </div>
    );
  }

  // Free plan gate
  if (isFreePlan) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateIcon}>
          <MessageSquare size={28} color="var(--color-text-secondary)" aria-hidden="true" />
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

  return (
    <div className={styles.wrapper}>
      {/* Connection status */}
      <div className={styles.statusRow}>
        <div className={styles.statusLabel}>
          <MessageSquare size={16} aria-hidden="true" />
          {tm('statusLabel')}
        </div>
        <Badge variant={status?.connected ? 'success' : 'neutral'} size="sm">
          {status?.connected ? tm('connected') : tm('notConnected')}
        </Badge>
      </div>

      {/* Connected */}
      {status?.connected && (
        <div className={styles.section}>
          {(status.pageName || status.pageId) && (
            <div className={styles.connectedInfo}>
              <CheckCircle size={14} color="var(--color-success)" aria-hidden="true" />
              <span>{tm('pageInfo')}: <strong>{status.pageName ?? status.pageId}</strong></span>
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
        <div className={styles.section}>
          <div className={styles.embeddedSignup}>
            <div className={styles.sectionTitle}>{tm('quickSetupTitle')}</div>
            <p className={styles.fieldHint}>{tm('quickSetupDesc')}</p>
            {hasSignup ? (
              <Button
                size="sm"
                onClick={handleConnect}
                icon={MessageSquare}
                loading={connecting}
              >
                {tm('connectMessenger')}
              </Button>
            ) : (
              <p className={styles.fieldHint}>{tm('unavailable')}</p>
            )}
            {connecting && signupStep && (
              <div className={styles.signupProgress}>
                <Spinner size="sm" />
                <span>{signupStep}</span>
              </div>
            )}
            {selectionOptions.length > 0 && (
              <div className={styles.selectionPanel}>
                <div className={styles.selectionTitle}>{tm('selectPage')}</div>
                <div className={styles.selectionOptions}>
                  {selectionOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className={styles.selectionOption}
                      onClick={() => handleSelectionContinue(opt.id)}
                      type="button"
                    >
                      <span className={styles.selectionOptName}>{opt.name}</span>
                      <span className={styles.selectionOptId}>{opt.id}</span>
                    </button>
                  ))}
                </div>
                <button
                  className={styles.cancelSelection}
                  onClick={resetSelection}
                  type="button"
                >
                  {tm('cancelSelection')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
