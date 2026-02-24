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
      toastError('Failed to load sub-accounts');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { loadSubAccounts(); }, [loadSubAccounts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/api/organization/sub-accounts', { name: subName, label: subLabel });
      success('Sub-account created');
      setCreateOpen(false);
      setSubName('');
      setSubLabel('');
      await loadSubAccounts();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to create sub-account');
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(subAcc: SubAccount) {
    setRemoving(true);
    try {
      await api.delete(`/api/organization/sub-accounts/${subAcc.childOrgId}`);
      success('Sub-account removed');
      setConfirmRemove(null);
      await loadSubAccounts();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to remove sub-account');
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
      success(`Switched to ${subAcc.name}`, 'Reloading dashboard...');
      setTimeout(() => window.location.replace('/dashboard'), 500);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to switch account');
    } finally {
      setSwitching(null);
    }
  }

  const isOwner = user?.role === 'owner';

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className={styles.pageTitle}>Sub-accounts</h1>
          <p className={styles.pageDesc}>Manage child organizations linked to your account.</p>
        </div>
        {isOwner && (
          <Button icon={Plus} onClick={() => setCreateOpen(true)} size="sm">
            Create Sub-account
          </Button>
        )}
      </div>

      <section className={styles.section}>
        {loading ? (
          <div className={styles.loadingWrapper}><Spinner size="md" /></div>
        ) : subAccounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
            <Building2 size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.4 }} />
            No sub-accounts yet. Create one to manage multiple organizations.
          </div>
        ) : (
          subAccounts.map((subAcc) => (
            <div key={subAcc.id} className={styles.subAccountRow}>
              <div className={styles.subAccountInfo}>
                <div className={styles.subAccountName}>{subAcc.name}</div>
                <div className={styles.subAccountMeta}>
                  {subAcc.label} · <span style={{ textTransform: 'capitalize' }}>{subAcc.plan}</span> plan
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
                  Switch
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
        title="Create Sub-account"
        size="sm"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Organization Name"
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="Branch Office Inc."
            required
            autoFocus
            icon={Building2}
          />
          <Input
            label="Label"
            value={subLabel}
            onChange={(e) => setSubLabel(e.target.value)}
            placeholder="branch-office"
            required
            hint="A short identifier for this sub-account"
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={creating} icon={Plus}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Remove Confirmation */}
      <Modal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove Sub-account"
        size="sm"
      >
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-warning)' }}>
          <AlertCircle size={16} />
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
            This will only unlink the sub-account. The organization itself will not be deleted.
          </p>
        </div>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          Remove <strong>{confirmRemove?.name}</strong> ({confirmRemove?.label}) from your sub-accounts?
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Button>
          <Button variant="danger" loading={removing} icon={Trash2} onClick={() => confirmRemove && handleRemove(confirmRemove)}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}
