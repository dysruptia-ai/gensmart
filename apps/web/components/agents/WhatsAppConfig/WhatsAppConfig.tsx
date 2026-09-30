'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, ExternalLink, Copy, Check, Unplug } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import { fbLoginEmbeddedSignup } from './fbLogin';
import { parseSignupMessage, isFinishEvent, isAbortEvent, type SignupEvent } from './signupEvent';
import styles from './WhatsAppConfig.module.css';

interface WhatsAppStatus {
  connected: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
  verifyToken: string | null;
  webhookUrl: string | null;
  channelEnabled: boolean;
}

interface WhatsAppConfigProps {
  agentId: string;
  orgPlan: string;
}

const FREE_PLAN_PLANS = ['free'];

// Manual Setup only helps when auto-discovery failed. Meta policy errors,
// plan gates or expired codes would fail the same way there.
const MANUAL_FALLBACK_CODES = new Set(['NO_WABA_SHARED', 'NO_PHONE_FOUND']);

export default function WhatsAppConfig({ agentId, orgPlan }: WhatsAppConfigProps) {
  const { success, error: toastError } = useToast();
  const { t } = useTranslation();
  const tw = (key: string, values?: Record<string, string | number>) => t('agents.channels.whatsappConfig.' + key, values);

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Manual setup form
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Copy state for webhook URL
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const isFreePlan = FREE_PLAN_PLANS.includes(orgPlan);
  const fbAppId = process.env['NEXT_PUBLIC_FACEBOOK_APP_ID'];
  const hasEmbeddedSignup = !!fbAppId;

  const [showManual, setShowManual] = useState(!hasEmbeddedSignup);
  const [signupStep, setSignupStep] = useState<string | null>(null);
  const [selectionType, setSelectionType] = useState<'waba' | 'phone' | null>(null);
  const [selectionOptions, setSelectionOptions] = useState<Array<{ id: string; name: string; verifiedName?: string; detail?: string }>>([]);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingWabaId, setPendingWabaId] = useState<string | null>(null);

  // Session event posted by the Embedded Signup popup (optional hint for the backend)
  const signupEventRef = useRef<SignupEvent | null>(null);

  useEffect(() => {
    function handler(evt: MessageEvent) {
      const parsed = parseSignupMessage(evt);
      if (parsed) signupEventRef.current = parsed;
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Load Facebook SDK when component mounts (needed for Embedded Signup)
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
      const data = await api.get<WhatsAppStatus>(`/api/whatsapp/status/${agentId}`);
      setStatus(data);
      if (data.phoneNumberId) setPhoneNumberId(data.phoneNumberId);
      if (data.wabaId) setWabaId(data.wabaId);
    } catch {
      // Non-critical — show not configured
      setStatus({
        connected: false,
        phoneNumberId: null,
        wabaId: null,
        verifyToken: null,
        webhookUrl: null,
        channelEnabled: false,
      });
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleManualConnect() {
    if (!phoneNumberId.trim() || !wabaId.trim()) {
      toastError(tw('toast.fillFields'));
      return;
    }
    // Access token is optional — if empty, the platform token will be used as fallback

    setConnecting(true);
    try {
      const data = await api.post<{
        verifyToken: string;
        webhookUrl: string;
        phoneNumber: string;
      }>('/api/whatsapp/connect', {
        agentId,
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        accessToken: accessToken.trim(),
      });

      success(tw('toast.connected', { phone: data.phoneNumber }));
      setAccessToken('');
      setShowManual(false);
      await loadStatus();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : tw('toast.connectFailed'));
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm(tw('toast.disconnectConfirm'))) {
      return;
    }
    setDisconnecting(true);
    try {
      await api.delete(`/api/whatsapp/disconnect/${agentId}`);
      success(tw('toast.disconnected'));
      await loadStatus();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : tw('toast.disconnectFailed'));
    } finally {
      setDisconnecting(false);
    }
  }

  function handleSignupError(err: unknown) {
    setSignupStep(null);
    const button = tw('connectFacebook');
    let msg = tw('errors.generic');
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'NO_WABA_SHARED':
          msg = tw('errors.noWaba');
          break;
        case 'NO_PHONE_FOUND':
          msg = tw('errors.noPhone');
          break;
        case 'SIGNUP_SESSION_EXPIRED':
          setSelectionType(null);
          setSelectionOptions([]);
          setPendingSessionId(null);
          setPendingWabaId(null);
          msg = tw('errors.sessionExpired', { button });
          break;
        case 'SIGNUP_SESSION_UNAVAILABLE':
          msg = tw('errors.sessionUnavailable');
          break;
        case 'PLAN_LIMIT':
          msg = tw('errors.planLimit');
          break;
        case 'PHONE_NOT_ADDED':
          msg = tw('errors.phoneNotAdded', { button });
          break;
        case 'PHONE_NOT_VERIFIED':
          msg = tw('errors.phoneNotVerified', { button });
          break;
        case 'PHONE_ALREADY_CONNECTED':
          msg = tw('errors.phoneAlreadyConnected');
          break;
        case 'INVALID_SELECTION':
          msg = tw('errors.invalidSelection', { button });
          break;
        case 'INVALID_FB_TOKEN':
          msg = tw('errors.invalidFbToken', { button });
          break;
        case 'CODE_EXCHANGE_FAILED':
          msg = tw('errors.codeExchangeFailed', { button });
          break;
        case 'WEBHOOK_SUBSCRIBE_FAILED':
          msg = tw('errors.webhookSubscribeFailed', { button });
          break;
        default:
          msg = err.message; // PHONE_REGISTER_FAILED already carries Meta's error_user_msg
      }
      if (err.code && MANUAL_FALLBACK_CODES.has(err.code)) setShowManual(true);
    }
    toastError(msg);
  }

  function handleEmbeddedSignup() {
    if (!fbAppId) return;

    const FB = (window as Window & { FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
    } }).FB;

    if (!FB) {
      toastError(tw('toast.sdkNotLoaded'));
      return;
    }

    const configId = process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID'] ?? '';

    signupEventRef.current = null;
    fbLoginEmbeddedSignup(FB, configId, function(code) {
      if (!code) {
        // The abort event may arrive just after the callback: wait up to 800ms for it.
        const abortStartedAt = Date.now();
        function reportAbort() {
          const evt = signupEventRef.current;
          if ((!evt || !isAbortEvent(evt)) && Date.now() - abortStartedAt < 800) {
            setTimeout(reportAbort, 100);
            return;
          }
          if (evt && evt.event === 'ERROR' && evt.error_message) {
            toastError(tw('toast.abortFacebookError', { message: evt.error_message, button: tw('connectFacebook') }));
          } else if (evt && evt.event === 'CANCEL' && evt.current_step && evt.current_step.includes('PHONE')) {
            toastError(tw('toast.abortPhoneStep', { button: tw('connectFacebook') }));
          } else {
            toastError(tw('toast.abortGeneric', { button: tw('connectFacebook') }));
          }
        }
        reportAbort();
        return;
      }

      setConnecting(true);
      setSignupStep(tw('steps.discovering'));

      // The popup's session event may arrive slightly after the code: wait up to 2s for it.
      // Plain callbacks only — this closure must not contain the forbidden keyword.
      const startedAt = Date.now();
      function submitWhenReady() {
        const evt = signupEventRef.current;
        if ((evt && isFinishEvent(evt)) || Date.now() - startedAt >= 2000) {
          sendSignupCode(code as string, evt && isFinishEvent(evt) ? evt : null);
          return;
        }
        setTimeout(submitWhenReady, 100);
      }
      submitWhenReady();
    });
  }

  function sendSignupCode(code: string, signupEvent: SignupEvent | null) {
    // Call the automated endpoint — backend exchanges the code for a token
    const body: Record<string, unknown> = { agentId, fbCode: code };
    if (signupEvent) body.signupEvent = signupEvent;
    api.post<Record<string, unknown>>('/api/whatsapp/embedded-signup-complete', body)
      .then(function(data) {
        if (data.requiresSelection) {
          // Backend found multiple options, ask user to select
          setSignupStep(null);
          setConnecting(false);
          setSelectionType(data.requiresSelection as 'waba' | 'phone');
          setSelectionOptions(data.options as Array<{ id: string; name: string; verifiedName?: string; detail?: string }>);
          setPendingSessionId(data.signupSessionId as string);
          if (data.selectedWabaId) setPendingWabaId(data.selectedWabaId as string);
          return;
        }
        setSignupStep(null);
        success(tw('toast.signupConnected', { phone: (data as { phoneNumber: string }).phoneNumber }));
        setShowManual(false);
        return loadStatus();
      })
      .catch(handleSignupError)
      .finally(function() {
        setConnecting(false);
        setSignupStep(null);
      });
  }

  function handleSelectionContinue(selectedId: string) {
    if (!pendingSessionId) return;

    setConnecting(true);
    setSelectionType(null);
    setSelectionOptions([]);
    setSignupStep(selectionType === 'waba' ? tw('steps.connectingWaba') : tw('steps.registeringPhone'));

    const body: Record<string, string> = {
      agentId,
      signupSessionId: pendingSessionId,
    };
    if (selectionType === 'waba') {
      body.selectedWabaId = selectedId;
    } else {
      body.selectedWabaId = pendingWabaId || '';
      body.selectedPhoneId = selectedId;
    }

    api.post<Record<string, unknown>>('/api/whatsapp/embedded-signup-complete', body)
      .then(function(data) {
        if (data.requiresSelection) {
          setSignupStep(null);
          setConnecting(false);
          setSelectionType(data.requiresSelection as 'waba' | 'phone');
          setSelectionOptions(data.options as Array<{ id: string; name: string; verifiedName?: string; detail?: string }>);
          if (data.selectedWabaId) setPendingWabaId(data.selectedWabaId as string);
          return;
        }
        setSignupStep(null);
        success(tw('toast.signupConnected', { phone: (data as { phoneNumber: string }).phoneNumber }));
        setShowManual(false);
        setPendingSessionId(null);
        setPendingWabaId(null);
        return loadStatus();
      })
      .catch(handleSignupError)
      .finally(function() {
        setConnecting(false);
      });
  }

  async function copyText(text: string, type: 'webhook' | 'token') {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'webhook') {
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2500);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2500);
      }
    } catch {
      toastError(tw('toast.copyFailed'));
    }
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
          <div className={styles.gateTitle}>{tw('gateTitle')}</div>
          <p className={styles.gateDesc}>
            {tw('gateDesc')}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => window.open('/pricing', '_blank')}
        >
          {tw('upgrade')}
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
          {t('agents.channels.whatsappStatus')}
        </div>
        <Badge variant={status?.connected ? 'success' : 'neutral'} size="sm">
          {status?.connected ? t('agents.channels.whatsappConnected') : tw('notConnected')}
        </Badge>
      </div>

      {status?.connected && status.phoneNumberId && (
        <div className={styles.connectedInfo}>
          <CheckCircle size={14} color="var(--color-success)" aria-hidden="true" />
          <span>{tw('phoneNumberIdInfo')}: <strong>{status.phoneNumberId}</strong></span>
        </div>
      )}

      {/* Connected actions */}
      {status?.connected && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{tw('webhookTitle')}</div>
          <p className={styles.fieldHint}>
            {tw('webhookHint')}{' '}
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className={styles.link}>
              {tw('metaDashboard')} <ExternalLink size={11} aria-hidden="true" />
            </a>
          </p>

          {status.webhookUrl && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{tw('webhookUrl')}</label>
              <div className={styles.copyRow}>
                <code className={styles.codeValue}>{status.webhookUrl}</code>
                <button
                  className={styles.copyBtn}
                  onClick={() => copyText(status.webhookUrl!, 'webhook')}
                  type="button"
                  aria-label={tw('copyWebhookUrl')}
                >
                  {copiedWebhook ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}

          {status.verifyToken && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{tw('verifyToken')}</label>
              <div className={styles.copyRow}>
                <code className={styles.codeValue}>{status.verifyToken}</code>
                <button
                  className={styles.copyBtn}
                  onClick={() => copyText(status.verifyToken!, 'token')}
                  type="button"
                  aria-label={tw('copyVerifyToken')}
                >
                  {copiedToken ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}

          <Button
            variant="danger"
            size="sm"
            icon={Unplug}
            onClick={handleDisconnect}
            loading={disconnecting}
          >
            {tw('disconnectButton')}
          </Button>
        </div>
      )}

      {/* Not connected — show setup options */}
      {!status?.connected && (
        <div className={styles.section}>
          {hasEmbeddedSignup && (
            <div className={styles.embeddedSignup}>
              <div className={styles.sectionTitle}>{tw('quickSetupTitle')}</div>
              <p className={styles.fieldHint}>
                {tw('quickSetupDesc')}
              </p>
              <Button
                size="sm"
                onClick={handleEmbeddedSignup}
                icon={MessageSquare}
                loading={connecting}
              >
                {tw('connectFacebook')}
              </Button>
              {connecting && signupStep && (
                <div className={styles.signupProgress}>
                  <Spinner size="sm" />
                  <span>{signupStep}</span>
                </div>
              )}
              {selectionType && selectionOptions.length > 0 && (
                <div className={styles.selectionPanel}>
                  <div className={styles.selectionTitle}>
                    {selectionType === 'waba'
                      ? tw('selectWaba')
                      : tw('selectPhone')}
                  </div>
                  <div className={styles.selectionOptions}>
                    {selectionOptions.map((opt) => (
                      <button
                        key={opt.id}
                        className={styles.selectionOption}
                        onClick={() => handleSelectionContinue(opt.id)}
                        type="button"
                      >
                        <span className={styles.selectionOptName}>
                          {opt.name}
                          {opt.verifiedName && (
                            <span className={styles.selectionOptVerified}> — {opt.verifiedName}</span>
                          )}
                        </span>
                        {opt.detail && (
                          <span className={styles.selectionOptDetail}>{opt.detail}</span>
                        )}
                        <span className={styles.selectionOptId}>{opt.id}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    className={styles.toggleManual}
                    onClick={() => { setSelectionType(null); setSelectionOptions([]); setPendingSessionId(null); setShowManual(true); }}
                    type="button"
                  >
                    {tw('cancelUseManual')}
                  </button>
                </div>
              )}
            </div>
          )}

          {!hasEmbeddedSignup && (
            <div className={styles.sectionTitle}>{tw('connectTitle')}</div>
          )}

          {hasEmbeddedSignup && (
            <>
              <div className={styles.divider}>
                <span>{tw('orSetupManually')}</span>
              </div>

              <button
                className={styles.toggleManual}
                onClick={() => setShowManual((v) => !v)}
                type="button"
              >
                {showManual ? tw('hideManual') : tw('showManual')}
              </button>
            </>
          )}

          {(showManual || !hasEmbeddedSignup) && (
            <div className={styles.manualForm}>
              <div className={styles.sectionTitle}>{tw('manualTitle')}</div>
              <p className={styles.fieldHint}>
                {tw('manualHint')}{' '}
                <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className={styles.link}>
                  {tw('metaDashboard')} <ExternalLink size={11} aria-hidden="true" />
                </a>
              </p>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>{tw('phoneNumberIdLabel')}</label>
                <Input
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder={tw('phoneNumberIdPlaceholder')}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>{tw('wabaIdLabel')}</label>
                <Input
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder={tw('wabaIdPlaceholder')}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>{tw('accessTokenLabel')}</label>
                <Input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxx..."
                  autoComplete="off"
                />
                <span className={styles.fieldHint}>
                  {tw('accessTokenHint')}
                </span>
              </div>

              <Button
                size="sm"
                onClick={handleManualConnect}
                loading={connecting}
                icon={CheckCircle}
              >
                {tw('connectButton')}
              </Button>
            </div>
          )}

          <div className={styles.docsLink}>
            <AlertCircle size={13} color="var(--color-info)" aria-hidden="true" />
            <a href="/docs/whatsapp-setup" target="_blank" rel="noopener noreferrer" className={styles.link}>
              {tw('setupGuide')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
