'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowRightLeft, Trash2, Building2, AlertCircle } from 'lucide-react';
import { api, ApiError, setAccessToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../settings.module.css';

interface SubAccount {
  id: string;
  childOrgId: string;
  label: string;
  name: string;
  plan: string;
  created_at: string;
}

export default function SubAccountsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const { t } = useTranslation();
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [subName, setSubName] = useState('');
  const [subLabel, setSubLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<SubAccount | null>(null);
  const [removing, setRemoving] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const loadSubAccounts = useCallback(async () => {
    try {
      const data = await api.get<SubAccount[]>('/api/organization/sub-accounts');
      setSubAccounts(data);
    } catch {
      toastError(t('settings.subAccounts.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [toastError, t]);

  useEffect(() => { loadSubAccounts(); }, [loadSubAccounts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/api/organization/sub-accounts', { name: subName, label: subLabel });
      success(t('settings.subAccounts.created'));
      setCreateOpen(false);
      setSubName('');
      setSubLabel('');
      await loadSubAccounts();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('settings.subAccounts.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(subAcc: SubAccount) {
    setRemoving(true);
    try {
      await api.delete(`/api/organization/sub-accounts/${subAcc.childOrgId}`);
      success(t('settings.subAccounts.removed'));
      setConfirmRemove(null);
      await loadSubAccounts();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('settings.subAccounts.removeFailed'));
    } finally {
      setRemoving(false);
    }
  }

  async function handleSwitch(subAcc: SubAccount) {
    setSwitching(subAcc.id);
    try {
      const result = await api.post<{ accessToken: string }>(
        `/api/organization/sub-accounts/${subAcc.childOrgId}/switch`
      );
      setAccessToken(result.accessToken);
      success(`Switched to ${subAcc.name}`, t('settings.subAccounts.switched'));
      setTimeout(() => window.location.replace('/dashboard'), 500);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('settings.subAccounts.switchFailed'));
    } finally {
      setSwitching(null);
    }
  }

  const isOwner = user?.role === 'owner';

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className={styles.pageTitle}>{t('settings.subAccounts.title')}</h1>
          <p className={styles.pageDesc}>{t('settings.subAccounts.description')}</p>
        </div>
        {isOwner && (
          <Button icon={Plus} onClick={() => setCreateOpen(true)} size="sm">
            {t('settings.subAccounts.create')}
          </Button>
        )}
      </div>

      <section className={styles.section}>
        {loading ? (
          <div className={styles.loadingWrapper}><Spinner size="md" /></div>
        ) : subAccounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
            <Building2 size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
            {t('settings.subAccounts.empty')}
          </div>
        ) : (
          subAccounts.map((subAcc) => (
            <div key={subAcc.id} className={styles.subAccountRow}>
              <div className={styles.subAccountInfo}>
                <div className={styles.subAccountName}>{subAcc.name}</div>
                <div className={styles.subAccountMeta}>
                  {subAcc.label} · <span style={{ textTransform: 'capitalize' }}>{subAcc.plan}</span> {t('settings.subAccounts.plan')}
                </div>
              </div>
              <div className={styles.subAccountActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowRightLeft}
                  loading={switching === subAcc.id}
                  onClick={() => handleSwitch(subAcc)}
                >
                  {t('settings.subAccounts.switch')}
                </Button>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setConfirmRemove(subAcc)}
                    aria-label="Remove sub-account"
                  />
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Create Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setSubName(''); setSubLabel(''); }}
        title={t('settings.subAccounts.createTitle')}
        size="sm"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label={t('settings.subAccounts.orgName')}
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="Branch Office Inc."
            required
            autoFocus
            icon={Building2}
          />
          <Input
            label={t('settings.subAccounts.label')}
            value={subLabel}
            onChange={(e) => setSubLabel(e.target.value)}
            placeholder="branch-office"
            required
            hint={t('settings.subAccounts.labelHint')}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={creating} icon={Plus}>{t('common.create')}</Button>
          </div>
        </form>
      </Modal>

      {/* Remove Confirmation */}
      <Modal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title={t('settings.subAccounts.removeTitle')}
        size="sm"
      >
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-warning)' }}>
          <AlertCircle size={16} />
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('settings.subAccounts.removeWarning')}
          </p>
        </div>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          {t('settings.subAccounts.removeConfirm', { name: confirmRemove?.name ?? '', label: confirmRemove?.label ?? '' })}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setConfirmRemove(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={removing} icon={Trash2} onClick={() => confirmRemove && handleRemove(confirmRemove)}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
