'use client';

import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import styles from '../settings.module.css';

interface ApiKeysData {
  openai_key: string | null;
  anthropic_key: string | null;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
}

export default function ApiKeysPage() {
  const { success, error: toastError } = useToast();
  const [data, setData] = useState<ApiKeysData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [openaiStatus, setOpenaiStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [anthropicStatus, setAnthropicStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => {
    api.get<ApiKeysData>('/api/organization/api-keys').then((res) => {
      setData(res);
    }).catch((err) => {
      if (err instanceof ApiError && err.status === 403) {
        toastError('BYO API Keys require Enterprise plan');
      }
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (openaiKey.trim()) body['openai_key'] = openaiKey.trim();
      if (anthropicKey.trim()) body['anthropic_key'] = anthropicKey.trim();

      await api.put('/api/organization/api-keys', body);
      success('API keys saved successfully');

      // Reload to get masked values
      const updated = await api.get<ApiKeysData>('/api/organization/api-keys');
      setData(updated);
      setOpenaiKey('');
      setAnthropicKey('');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to save keys');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveKey(type: 'openai' | 'anthropic') {
    try {
      const body: Record<string, string> = {};
      if (type === 'openai') body['openai_key'] = '';
      else body['anthropic_key'] = '';
      await api.put('/api/organization/api-keys', body);
      success('API key removed');
      const updated = await api.get<ApiKeysData>('/api/organization/api-keys');
      setData(updated);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to remove key');
    }
  }

  async function testKey(type: 'openai' | 'anthropic') {
    const key = type === 'openai' ? openaiKey.trim() : anthropicKey.trim();
    if (!key && !(type === 'openai' ? data?.hasOpenaiKey : data?.hasAnthropicKey)) {
      toastError('Enter a key first');
      return;
    }

    if (type === 'openai') setTestingOpenai(true);
    else setTestingAnthropic(true);

    try {
      // Simple test via a backend endpoint that attempts a minimal API call
      await api.post('/api/organization/api-keys/test', { type, key: key || undefined });
      if (type === 'openai') setOpenaiStatus('ok');
      else setAnthropicStatus('ok');
      success('API key is valid');
    } catch {
      if (type === 'openai') setOpenaiStatus('error');
      else setAnthropicStatus('error');
      toastError('API key validation failed');
    } finally {
      if (type === 'openai') setTestingOpenai(false);
      else setTestingAnthropic(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <Key size={24} style={{ opacity: 0.4, margin: '0 auto 0.5rem', display: 'block' }} />
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>API Keys</h1>
        <p className={styles.pageDesc}>
          Use your own OpenAI or Anthropic API keys. When active, message limits don&apos;t apply.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>OpenAI API Key</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGridFull}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="API Key"
                    type={showOpenai ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => { setOpenaiKey(e.target.value); setOpenaiStatus('idle'); }}
                    placeholder={data?.hasOpenaiKey ? data.openai_key ?? '••••••••' : 'sk-proj-...'}
                    icon={Key}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowOpenai((v) => !v)}
                  style={{ marginBottom: '0', height: '40px' }}
                >
                  {showOpenai ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
                {openaiStatus === 'ok' && <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0, marginBottom: '0.5rem' }} />}
                {openaiStatus === 'error' && <AlertCircle size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginBottom: '0.5rem' }} />}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => testKey('openai')}
                loading={testingOpenai}
              >
                Test Key
              </Button>
              {data?.hasOpenaiKey && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRemoveKey('openai')}
                >
                  Remove Key
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Anthropic API Key</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGridFull}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="API Key"
                    type={showAnthropic ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={(e) => { setAnthropicKey(e.target.value); setAnthropicStatus('idle'); }}
                    placeholder={data?.hasAnthropicKey ? data.anthropic_key ?? '••••••••' : 'sk-ant-...'}
                    icon={Key}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAnthropic((v) => !v)}
                  style={{ marginBottom: '0', height: '40px' }}
                >
                  {showAnthropic ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
                {anthropicStatus === 'ok' && <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0, marginBottom: '0.5rem' }} />}
                {anthropicStatus === 'error' && <AlertCircle size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginBottom: '0.5rem' }} />}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => testKey('anthropic')}
                loading={testingAnthropic}
              >
                Test Key
              </Button>
              {data?.hasAnthropicKey && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRemoveKey('anthropic')}
                >
                  Remove Key
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className={styles.formActions}>
          <Button type="submit" loading={saving}>
            Save API Keys
          </Button>
        </div>
      </form>
    </div>
  );
}
