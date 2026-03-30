'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, ExternalLink, Copy, Check, Unplug } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { fbLoginEmbeddedSignup } from './fbLogin';
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

export default function WhatsAppConfig({ agentId, orgPlan }: WhatsAppConfigProps) {
  const { success, error: toastError } = useToast();

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
  const [selectionOptions, setSelectionOptions] = useState<Array<{ id: string; name: string; verifiedName?: string }>>([]);
  const [pendingFbToken, setPendingFbToken] = useState<string | null>(null);
  const [pendingWabaId, setPendingWabaId] = useState<string | null>(null);

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
        version: 'v21.0',
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
      toastError('Please fill in Phone Number ID and WABA ID');
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

      success(`Connected! Phone: ${data.phoneNumber}`);
      setAccessToken('');
      setShowManual(false);
      await loadStatus();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to connect WhatsApp');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Disconnect WhatsApp from this agent? The agent will no longer receive or send WhatsApp messages.')) {
      return;
    }
    setDisconnecting(true);
    try {
      await api.delete(`/api/whatsapp/disconnect/${agentId}`);
      success('WhatsApp disconnected');
      await loadStatus();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }

  function handleEmbeddedSignup() {
    if (!fbAppId) return;

    const FB = (window as Window & { FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (response: { authResponse?: { accessToken?: string } }) => void, opts: Record<string, unknown>) => void;
    } }).FB;

    if (!FB) {
      toastError('Facebook SDK not loaded. Please refresh and try again.');
      return;
    }

    const configId = process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID'] ?? '';

    fbLoginEmbeddedSignup(FB, configId, function(fbToken) {
      if (!fbToken) {
        toastError('Connection cancelled. Click "Connect with Facebook" to try again. Make sure to complete all steps in the Facebook popup.');
        return;
      }

      // Call the new automated endpoint
      setConnecting(true);
      setSignupStep('Discovering your WhatsApp account...');
      api.post<Record<string, unknown>>('/api/whatsapp/embedded-signup-complete', {
        agentId,
        fbAccessToken: fbToken,
      })
        .then(function(data) {
          if (data.requiresSelection) {
            // Backend found multiple options, ask user to select
            setSignupStep(null);
            setConnecting(false);
            setSelectionType(data.requiresSelection as 'waba' | 'phone');
            setSelectionOptions(data.options as Array<{ id: string; name: string; verifiedName?: string }>);
            setPendingFbToken(data.fbAccessToken as string);
            if (data.selectedWabaId) setPendingWabaId(data.selectedWabaId as string);
            return;
          }
          setSignupStep(null);
          success(`WhatsApp connected! Phone: ${(data as { phoneNumber: string }).phoneNumber}`);
          setShowManual(false);
          return loadStatus();
        })
        .catch(function(err: unknown) {
          setSignupStep(null);
          let msg = 'Failed to connect WhatsApp.';
          if (err instanceof ApiError) {
            if (err.message.includes('NO_WABA_SHARED') || err.message.includes('Could not find your WhatsApp Business Account')) {
              msg = 'We couldn\'t find your WhatsApp Business Account. Make sure you completed all steps in the Facebook popup, or use Manual Setup below.';
            } else if (err.message.includes('NO_PHONE_FOUND')) {
              msg = 'No phone number found in your WhatsApp Business Account. Complete your WhatsApp Business setup in Meta Business Manager first.';
            } else if (err.message.includes('PLAN_LIMIT')) {
              msg = 'WhatsApp requires a Starter plan or higher.';
            } else {
              msg = err.message;
            }
          }
          toastError(msg);
          setShowManual(true);
        })
        .finally(function() {
          setConnecting(false);
          setSignupStep(null);
        });
    });
  }

  function handleSelectionContinue(selectedId: string) {
    if (!pendingFbToken) return;

    setConnecting(true);
    setSelectionType(null);
    setSelectionOptions([]);
    setSignupStep(selectionType === 'waba' ? 'Connecting your WhatsApp account...' : 'Registering your phone number...');

    const body: Record<string, string> = {
      agentId,
      fbAccessToken: pendingFbToken,
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
          setSelectionOptions(data.options as Array<{ id: string; name: string; verifiedName?: string }>);
          if (data.selectedWabaId) setPendingWabaId(data.selectedWabaId as string);
          return;
        }
        setSignupStep(null);
        success(`WhatsApp connected! Phone: ${(data as { phoneNumber: string }).phoneNumber}`);
        setShowManual(false);
        setPendingFbToken(null);
        setPendingWabaId(null);
        return loadStatus();
      })
      .catch(function(err: unknown) {
        setSignupStep(null);
        toastError(err instanceof ApiError ? err.message : 'Failed to connect WhatsApp.');
        setShowManual(true);
      })
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
      toastError('Failed to copy');
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
          <div className={styles.gateTitle}>WhatsApp Requires Starter Plan</div>
          <p className={styles.gateDesc}>
            Connect your WhatsApp Business account to deploy this agent on WhatsApp. Available on Starter, Pro, and Enterprise plans.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => window.open('/pricing', '_blank')}
        >
          Upgrade Plan
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
          WhatsApp Status
        </div>
        <Badge variant={status?.connected ? 'success' : 'neutral'} size="sm">
          {status?.connected ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {status?.connected && status.phoneNumberId && (
        <div className={styles.connectedInfo}>
          <CheckCircle size={14} color="var(--color-success)" aria-hidden="true" />
          <span>Phone Number ID: <strong>{status.phoneNumberId}</strong></span>
        </div>
      )}

      {/* Connected actions */}
      {status?.connected && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Webhook Configuration</div>
          <p className={styles.fieldHint}>
            Set these values in your{' '}
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className={styles.link}>
              Meta Developer Dashboard <ExternalLink size={11} aria-hidden="true" />
            </a>
          </p>

          {status.webhookUrl && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Webhook URL</label>
              <div className={styles.copyRow}>
                <code className={styles.codeValue}>{status.webhookUrl}</code>
                <button
                  className={styles.copyBtn}
                  onClick={() => copyText(status.webhookUrl!, 'webhook')}
                  type="button"
                  aria-label="Copy webhook URL"
                >
                  {copiedWebhook ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}

          {status.verifyToken && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Verify Token</label>
              <div className={styles.copyRow}>
                <code className={styles.codeValue}>{status.verifyToken}</code>
                <button
                  className={styles.copyBtn}
                  onClick={() => copyText(status.verifyToken!, 'token')}
                  type="button"
                  aria-label="Copy verify token"
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
            Disconnect WhatsApp
          </Button>
        </div>
      )}

      {/* Not connected — show setup options */}
      {!status?.connected && (
        <div className={styles.section}>
          {hasEmbeddedSignup && (
            <div className={styles.embeddedSignup}>
              <div className={styles.sectionTitle}>Quick Setup (Recommended)</div>
              <p className={styles.fieldHint}>
                Connect using Facebook Login — we&apos;ll automatically configure your WhatsApp Business account, subscribe the webhook, and register your number.
              </p>
              <Button
                size="sm"
                onClick={handleEmbeddedSignup}
                icon={MessageSquare}
                loading={connecting}
              >
                Connect with Facebook
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
                      ? 'Select your WhatsApp Business Account'
                      : 'Select your phone number'}
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
                        <span className={styles.selectionOptId}>{opt.id}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    className={styles.toggleManual}
                    onClick={() => { setSelectionType(null); setSelectionOptions([]); setPendingFbToken(null); setShowManual(true); }}
                    type="button"
                  >
                    Cancel — use Manual Setup instead
                  </button>
                </div>
              )}
            </div>
          )}

          {!hasEmbeddedSignup && (
            <div className={styles.sectionTitle}>Connect WhatsApp</div>
          )}

          {hasEmbeddedSignup && (
            <>
              <div className={styles.divider}>
                <span>or setup manually</span>
              </div>

              <button
                className={styles.toggleManual}
                onClick={() => setShowManual((v) => !v)}
                type="button"
              >
                {showManual ? '▲ Hide Manual Setup' : '▼ Manual Setup'}
              </button>
            </>
          )}

          {(showManual || !hasEmbeddedSignup) && (
            <div className={styles.manualForm}>
              <div className={styles.sectionTitle}>Manual Setup</div>
              <p className={styles.fieldHint}>
                Enter your WhatsApp Business credentials from the{' '}
                <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className={styles.link}>
                  Meta Developer Dashboard <ExternalLink size={11} aria-hidden="true" />
                </a>
              </p>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Phone Number ID</label>
                <Input
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="e.g. 123456789012345"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>WABA ID (WhatsApp Business Account ID)</label>
                <Input
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder="e.g. 987654321098765"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Permanent Access Token</label>
                <Input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxx..."
                  autoComplete="off"
                />
                <span className={styles.fieldHint}>
                  Generate a permanent token in Meta Business Manager → System Users
                </span>
              </div>

              <Button
                size="sm"
                onClick={handleManualConnect}
                loading={connecting}
                icon={CheckCircle}
              >
                Connect
              </Button>
            </div>
          )}

          <div className={styles.docsLink}>
            <AlertCircle size={13} color="var(--color-info)" aria-hidden="true" />
            <a href="/docs/whatsapp-setup" target="_blank" rel="noopener noreferrer" className={styles.link}>
              View WhatsApp Setup Guide
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
