'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Wifi, WifiOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import styles from '../admin.module.css';

interface PlatformSetting {
  key: string;
  value: string;
  is_encrypted: boolean;
  description: string | null;
  updated_at: string;
}

interface TokenTestResult {
  valid: boolean;
  appId?: string;
  expiresAt?: string;
  error?: string;
}

const SETTING_CONFIG: Record<string, { label: string; type: 'text' | 'password'; readOnly?: boolean }> = {
  whatsapp_system_user_token: { label: 'System User Token', type: 'password' },
  whatsapp_verify_token: { label: 'Verify Token', type: 'text' },
  whatsapp_app_secret: { label: 'App Secret', type: 'password' },
  meta_app_id: { label: 'Meta App ID', type: 'text' },
  meta_config_id: { label: 'Login Config ID', type: 'text' },
  whatsapp_webhook_url: { label: 'Webhook URL', type: 'text', readOnly: true },
};

export default function AdminSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [tokenTest, setTokenTest] = useState<TokenTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.get<PlatformSetting[]>('/api/admin/settings');
      console.log('[admin-settings] Loaded settings:', data.map(s => ({ key: s.key, value: s.is_encrypted ? '(encrypted)' : s.value })));
      setSettings(data);
      // Initialize edit values — empty for encrypted (masked), actual value for non-encrypted
      const values: Record<string, string> = {};
      data.forEach((s) => {
        values[s.key] = s.is_encrypted ? '' : s.value;
      });
      setEditValues(values);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSave(key: string) {
    const value = editValues[key] ?? '';
    if (!value) {
      toast.warning('Enter a value before saving');
      return;
    }

    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await api.put(`/api/admin/settings/${key}`, { value });
      console.log('[admin-settings] Saved key:', key, 'value length:', value.length);
      toast.success('Setting updated');
      // Reload to get fresh masked values
      await loadSettings();
    } catch {
      toast.error('Failed to save setting');
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function handleTestToken() {
    setTesting(true);
    setTokenTest(null);
    try {
      const result = await api.post<TokenTestResult>('/api/admin/settings/test-whatsapp');
      setTokenTest(result);
      if (result.valid) {
        toast.success('WhatsApp token is valid');
      } else {
        toast.error(result.error ?? 'Token is invalid');
      }
    } catch {
      toast.error('Failed to test token');
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Platform Settings</h1>
        <p className={styles.pageDesc}>Configure WhatsApp Cloud API credentials and platform-wide settings</p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Settings size={18} />
          WhatsApp Configuration
        </h2>

        {settings.map((setting) => {
          const config = SETTING_CONFIG[setting.key];
          if (!config) return null;
          const isReadOnly = config.readOnly ?? false;
          const isEncrypted = setting.is_encrypted;
          const currentValue = editValues[setting.key] ?? '';

          return (
            <div className={styles.settingRow} key={setting.key}>
              <div className={styles.settingLabel}>
                {config.label}
                {setting.description && (
                  <div className={styles.settingLabelDesc}>{setting.description}</div>
                )}
              </div>
              <div className={styles.settingValue}>
                <input
                  className={styles.settingInput}
                  type={config.type}
                  value={currentValue}
                  readOnly={isReadOnly}
                  placeholder={isEncrypted && !currentValue ? 'Enter new value to update' : undefined}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, [setting.key]: e.target.value }))
                  }
                />
                {!isReadOnly && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={saving[setting.key] ?? false}
                    onClick={() => handleSave(setting.key)}
                  >
                    Save
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Token test section */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid var(--color-border)` }}>
          <Button
            variant="outline"
            size="sm"
            loading={testing}
            onClick={handleTestToken}
            icon={tokenTest?.valid ? Wifi : WifiOff}
          >
            Test WhatsApp Connection
          </Button>

          {tokenTest && (
            <div className={styles.tokenStatus}>
              <span className={`${styles.statusDot} ${tokenTest.valid ? styles.statusDotGreen : styles.statusDotRed}`} />
              {tokenTest.valid ? (
                <span>
                  Valid — App ID: {tokenTest.appId}, Expires: {tokenTest.expiresAt}
                </span>
              ) : (
                <span>{tokenTest.error ?? 'Invalid token'}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
