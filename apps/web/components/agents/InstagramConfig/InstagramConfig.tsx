'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, CheckCircle, Unplug } from 'lucide-react';
import { PLAN_LIMITS } from '@gensmart/shared';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import { fbLoginEmbeddedSignup } from '../WhatsAppConfig/fbLogin';
import styles from './InstagramConfig.module.css';

interface InstagramStatus {
  connected: boolean;
  instagramId: string | null;
  instagramUsername: string | null;
  webhookUrl: string | null;
  channelEnabled: boolean;
}

interface AccountOption {
  id: string;
  name: string; // "@username"
}

interface SignupResponse {
  success: boolean;
  requiresSelection?: 'account';
  options?: AccountOption[];
  signupSessionId?: string;
  instagramId?: string;
  instagramUsername?: string;
}

interface InstagramConfigProps {
  agentId: string;
  orgPlan: string;
}

export default function InstagramConfig({ agentId, orgPlan }: InstagramConfigProps) {
  const { success, error: toastError } = useToast();
  const { t } = useTranslation();
  const tm = (key: string, values?: Record<string, string | number>) => t('agents.channels.instagramConfig.' + key, values);

  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // True from the click until the flow ends (covers the window while the Facebook popup is open)
  const [launching, setLaunching] = useState(false);
  const submittingRef = useRef(false);
  const [signupStep, setSignupStep] = useState<string | null>(null);
  const [selectionOptions, setSelectionOptions] = useState<AccountOption[]>([]);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  const planKey = (orgPlan in PLAN_LIMITS ? orgPlan : 'free') as keyof typeof PLAN_LIMITS;
  const isFreePlan = !(PLAN_LIMITS[planKey].channels as readonly string[]).includes('instagram');
  const fbAppId = process.env['NEXT_PUBLIC_FACEBOOK_APP_ID'];
  const configId = process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID_INSTAGRAM'];
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
      const data = await api.get<InstagramStatus>(`/api/instagram/status/${agentId}`);
      setStatus(data);
    } catch {
      // Non-critical — show not connected
      setStatus({ connected: false, instagramId: null, instagramUsername: null, webhookUrl: null, channelEnabled: false });
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
      await api.delete(`/api/instagram/disconnect/${agentId}`);
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
    const button = tm('connectInstagram');
    let msg = tm('errors.generic');
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'NO_INSTAGRAM_ACCOUNTS_FOUND':
          msg = tm('errors.noAccounts');
          break;
        case 'ACCOUNT_LIST_FAILED':
          msg = tm('errors.accountListFailed');
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
        case 'ACCOUNT_ALREADY_CONNECTED':
          msg = tm('errors.accountAlreadyConnected');
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
        case 'MESSAGING_DISABLED':
          msg = tm('errors.messagingDisabled');
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

  // Shared by the first call (fbToken) and the account re-selection call (signupSessionId + selectedInstagramId)
  function submitSignup(body: Record<string, string>) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    api.post<SignupResponse>('/api/instagram/embedded-signup-complete', body)
      .then(function(data) {
        if (data.requiresSelection === 'account') {
          setSignupStep(null);
          setSelectionOptions(data.options ?? []);
          setPendingSessionId(data.signupSessionId ?? null);
          return;
        }
        resetSelection();
        success(tm('toast.signupConnected', { account: data.instagramUsername ? '@' + data.instagramUsername : data.instagramId ?? '' }));
        return loadStatus();
      })
      .catch(handleSignupError)
      .finally(function() {
        submittingRef.current = false;
        setConnecting(false);
        setLaunching(false);
        setSignupStep(null);
      });
  }

  function handleConnect() {
    if (!hasSignup || launching || connecting || submittingRef.current) return;

    const FB = (window as Window & { FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
    } }).FB;

    if (!FB) {
      toastError(tm('toast.sdkNotLoaded'));
      return;
    }

    setLaunching(true);

    // Plain callbacks only: the SDK scans this closure for the forbidden keyword.
    fbLoginEmbeddedSignup(FB, configId as string, function(accessToken) {
      if (!accessToken) {
        setLaunching(false);
        toastError(tm('toast.abortGeneric', { button: tm('connectInstagram') }));
        return;
      }
      setConnecting(true);
      setSignupStep(tm('steps.connecting'));
      submitSignup({ agentId, fbToken: accessToken });
    }, { responseType: 'token' });
  }

  function handleSelectionContinue(accountId: string) {
    if (!pendingSessionId || connecting || submittingRef.current) return;

    setConnecting(true);
    setSignupStep(tm('steps.connectingAccount'));
    const sessionId = pendingSessionId;
    setSelectionOptions([]);
    submitSignup({ agentId, signupSessionId: sessionId, selectedInstagramId: accountId });
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
          {(status.instagramUsername || status.instagramId) && (
            <div className={styles.connectedInfo}>
              <CheckCircle size={14} color="var(--color-success)" aria-hidden="true" />
              <span>{tm('accountInfo')}: <strong>{status.instagramUsername ? `@${status.instagramUsername}` : status.instagramId}</strong></span>
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
                loading={launching || connecting}
              >
                {tm('connectInstagram')}
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
                <div className={styles.selectionTitle}>{tm('selectAccount')}</div>
                <div className={styles.selectionOptions}>
                  {selectionOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className={styles.selectionOption}
                      onClick={() => handleSelectionContinue(opt.id)}
                      disabled={connecting}
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
