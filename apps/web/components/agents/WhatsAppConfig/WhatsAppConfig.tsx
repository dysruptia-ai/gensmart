'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, ExternalLink, Copy, Check, Unplug } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
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
  const [showManual, setShowManual] = useState(false);
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
    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) {
      toastError('Please fill in all fields');
      return;
    }

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
      login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
    } }).FB;

    if (!FB) {
      toastError('Facebook SDK not loaded. Please try the manual setup.');
      return;
    }

    // IMPORTANT: FB.login callback must be a plain synchronous function.
    // The SDK inspects the callback with .toString() and throws if it finds
    // the word "async" anywhere in the function text — including inside nested IIFEs.
    // Solution: use Promise.resolve().then() chains (no "async" keyword anywhere).
    FB.login(
      function(response) {
        const code = response && response.authResponse && response.authResponse.code;
        if (!code) {
          toastError('Facebook login was cancelled or failed.');
          return;
        }
        Promise.resolve()
          .then(function() {
            return api.post<{ success: boolean; message: string }>('/api/whatsapp/embedded-signup', { agentId, code });
          })
          .then(function(data) {
            success(data.message ?? 'Access token saved. Complete manual setup below.');
            setShowManual(true);
            return loadStatus();
          })
          .catch(function(err: unknown) {
            toastError(err instanceof ApiError ? err.message : 'Failed to complete WhatsApp setup');
          });
      },
      {
        config_id: process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID'] ?? '',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      }
    );
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
              <div className={styles.sectionTitle}>Quick Setup</div>
              <p className={styles.fieldHint}>
                Connect using Facebook Login — automatically configures your WhatsApp Business account.
              </p>
              <Button
                size="sm"
                onClick={handleEmbeddedSignup}
                icon={MessageSquare}
              >
                Connect with Facebook
              </Button>
            </div>
          )}

          <div className={styles.divider}>
            {hasEmbeddedSignup && <span>or setup manually</span>}
          </div>

          <button
            className={styles.toggleManual}
            onClick={() => setShowManual((v) => !v)}
            type="button"
          >
            {showManual ? '▲ Hide Manual Setup' : '▼ Manual Setup'}
          </button>

          {showManual && (
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
