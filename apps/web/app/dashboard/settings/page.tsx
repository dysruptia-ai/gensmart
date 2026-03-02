'use client';

import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import styles from './settings.module.css';

interface OrgData {
  id: string;
  name: string;
  plan: string;
  settings: { timezone?: string; language?: string };
  created_at: string;
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'America/Sao_Paulo', 'America/Mexico_City',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-sm)',
  background: 'var(--color-bg-card)',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
};

export default function GeneralSettingsPage() {
  const { refreshUser } = useAuth();
  const { language: ctxLanguage, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const { success, error: toastError } = useToast();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [language, setLanguageState] = useState<'en' | 'es'>('en');

  useEffect(() => {
    api.get<OrgData>('/api/organization').then((data) => {
      setOrg(data);
      setOrgName(data.name);
      setTimezone(data.settings?.timezone ?? 'UTC');
      setLanguageState((ctxLanguage as 'en' | 'es') ?? 'en');
    }).catch(() => {
      toastError('Failed to load organization settings');
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Save org name + timezone
      await api.put('/api/organization', {
        name: orgName,
        settings: { timezone },
      });

      // Save user language preference (and update context)
      if (language !== ctxLanguage) {
        setLanguage(language);
        // setLanguage already calls PUT /api/auth/me — no need to call again
      }

      await refreshUser();
      success(t('settings.general.saved'));
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('settings.general.title')}</h1>
        <p className={styles.pageDesc}>{t('settings.general.description')}</p>
      </div>

      <form onSubmit={handleSave}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.general.organization')}</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGridFull}>
              <Input
                label={t('settings.general.orgName')}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Corp"
                required
                icon={Building2}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>
                {t('settings.general.plan')}
              </label>
              <div style={{ padding: '0.5rem 0.75rem', background: 'var(--color-bg-main)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', textTransform: 'capitalize' }}>
                {org?.plan ?? '—'}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.general.preferences')}</h2>
          <div className={styles.formGrid}>
            <div>
              <label htmlFor="timezone" style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>
                {t('settings.general.timezone')}
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={selectStyle}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="language" style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>
                {t('settings.general.language')}
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguageState(e.target.value as 'en' | 'es')}
                style={selectStyle}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div className={styles.formActions}>
          <Button type="submit" loading={saving}>
            {t('settings.general.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
