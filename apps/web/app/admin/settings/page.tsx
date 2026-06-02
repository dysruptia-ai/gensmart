'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings, Wifi, WifiOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import styles from '../admin.module.css';

type SettingCategory = 'whatsapp' | 'mastershop' | 'dropi' | 'zendrop' | 'synchroteam' | 'other';

interface SettingMeta {
  key: string;
  description: string | null;
  is_encrypted: boolean;
  has_value: boolean;
  value: string | null;
  category: SettingCategory;
  updated_at: string;
}

interface TokenTestResult {
  valid: boolean;
  appId?: string;
  expiresAt?: string;
  error?: string;
}

const CATEGORY_ORDER: SettingCategory[] = ['whatsapp', 'mastershop', 'dropi', 'zendrop', 'synchroteam', 'other'];

const READ_ONLY_KEYS = new Set<string>(['whatsapp_webhook_url']);

const ACRONYMS: Record<string, string> = {
  mcp: 'MCP',
  api: 'API',
  id: 'ID',
  url: 'URL',
  whatsapp: 'WhatsApp',
};

function humanizeKey(key: string): string {
  return key
    .split('_')
    .map((part) => {
      const lower = part.toLowerCase();
      if (ACRONYMS[lower]) return ACRONYMS[lower];
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SettingMeta[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [tokenTest, setTokenTest] = useState<TokenTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.get<SettingMeta[]>('/api/admin/settings/all');
      setSettings(data);
      const values: Record<string, string> = {};
      data.forEach((s) => {
        values[s.key] = s.is_encrypted ? '' : (s.value ?? '');
      });
      setEditValues(values);
    } catch {
      toast.error(t('admin.settings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const grouped = useMemo(() => {
    const acc: Record<SettingCategory, SettingMeta[]> = {
      whatsapp: [],
      mastershop: [],
      dropi: [],
      zendrop: [],
      synchroteam: [],
      other: [],
    };
    for (const s of settings) {
      acc[s.category].push(s);
    }
    return acc;
  }, [settings]);

  async function handleSave(key: string) {
    const value = editValues[key] ?? '';
    if (!value) {
      toast.warning(t('admin.settings.emptyValueWarning'));
      return;
    }

    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await api.put(`/api/admin/settings/${key}`, { value });
      toast.success(t('admin.settings.saved'));
      await loadSettings();
    } catch {
      toast.error(t('admin.settings.saveError'));
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
        toast.success(t('admin.settings.testSuccess'));
      } else {
        toast.error(result.error ?? t('admin.settings.testInvalid'));
      }
    } catch {
      toast.error(t('admin.settings.testFailed'));
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
        <h1 className={styles.pageTitle}>{t('admin.settings.title')}</h1>
        <p className={styles.pageDesc}>{t('admin.settings.description')}</p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = grouped[category];
        if (items.length === 0) return null;

        return (
          <div className={styles.card} key={category}>
            <h2 className={styles.cardTitle}>
              <Settings size={18} />
              {t(`admin.settings.categories.${category}`)}
            </h2>

            {items.map((setting) => {
              const isReadOnly = READ_ONLY_KEYS.has(setting.key);
              const isEncrypted = setting.is_encrypted;
              const currentValue = editValues[setting.key] ?? '';
              const placeholder = isEncrypted
                ? setting.has_value
                  ? t('admin.settings.configuredPlaceholder')
                  : t('admin.settings.newValuePlaceholder')
                : undefined;

              return (
                <div className={styles.settingRow} key={setting.key}>
                  <div className={styles.settingLabel}>
                    {humanizeKey(setting.key)}
                    {setting.description && (
                      <div className={styles.settingLabelDesc}>{setting.description}</div>
                    )}
                  </div>
                  <div className={styles.settingValue}>
                    <input
                      className={styles.settingInput}
                      type={isEncrypted ? 'password' : 'text'}
                      value={currentValue}
                      readOnly={isReadOnly}
                      placeholder={placeholder}
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
                        {t('admin.settings.save')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {category === 'whatsapp' && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid var(--color-border)` }}>
                <Button
                  variant="outline"
                  size="sm"
                  loading={testing}
                  onClick={handleTestToken}
                  icon={tokenTest?.valid ? Wifi : WifiOff}
                >
                  {t('admin.settings.testWhatsApp')}
                </Button>

                {tokenTest && (
                  <div className={styles.tokenStatus}>
                    <span className={`${styles.statusDot} ${tokenTest.valid ? styles.statusDotGreen : styles.statusDotRed}`} />
                    {tokenTest.valid ? (
                      <span>
                        {t('admin.settings.testValid', {
                          appId: tokenTest.appId ?? '',
                          expiresAt: tokenTest.expiresAt ?? '',
                        })}
                      </span>
                    ) : (
                      <span>{tokenTest.error ?? t('admin.settings.testInvalid')}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
