'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Bot, CreditCard, ShieldOff, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import styles from '../../admin.module.css';

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  settings: Record<string, unknown>;
  created_at: string;
}

interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: string;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface OrgAgent {
  id: string;
  name: string;
  status: string;
  llmProvider: string;
  llmModel: string;
  channels: unknown;
  createdAt: string;
}

interface OrgDetailResponse {
  organization: OrgDetail;
  users: OrgUser[];
  agents: OrgAgent[];
}

const PLAN_BADGE: Record<string, string> = {
  free: 'badgeFree',
  starter: 'badgeStarter',
  pro: 'badgePro',
  enterprise: 'badgeEnterprise',
};

const PLANS = ['solo', 'starter', 'pro', 'enterprise'] as const;

export default function AdminOrgDetailPage() {
  const params = useParams();
  const orgId = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<OrgDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState(false);
  const [reset2FAModal, setReset2FAModal] = useState<OrgUser | null>(null);
  const [resetting2FA, setResetting2FA] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadOrg = useCallback(async () => {
    try {
      const result = await api.get<OrgDetailResponse>(`/api/admin/organizations/${orgId}`);
      setData(result);
    } catch {
      toast.error('Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

  async function handlePlanChange(newPlan: string) {
    setChangingPlan(true);
    try {
      await api.put(`/api/admin/organizations/${orgId}/plan`, { plan: newPlan });
      toast.success(`Plan updated to ${newPlan}`);
      await loadOrg();
    } catch {
      toast.error('Failed to change plan');
    } finally {
      setChangingPlan(false);
    }
  }

  async function handleReset2FA() {
    if (!reset2FAModal) return;
    setResetting2FA(true);
    try {
      await api.post(`/api/admin/organizations/${orgId}/reset-2fa`, { userId: reset2FAModal.id });
      toast.success(`2FA reset for ${reset2FAModal.email}`);
      setReset2FAModal(null);
      await loadOrg();
    } catch {
      toast.error('Failed to reset 2FA');
    } finally {
      setResetting2FA(false);
    }
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteModalOpen(false);
    setDeleteConfirmText('');
  }

  async function handleDeleteOrg() {
    if (!data) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/organizations/${orgId}`, { confirmName: deleteConfirmText });
      toast.success(`Organization "${data.organization.name}" deleted`);
      router.push('/admin/organizations');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'HAS_SUB_ACCOUNTS') {
        toast.error('Esta organización tiene sub-cuentas, quitalas primero');
      } else {
        toast.error('Failed to delete organization');
      }
      setDeleting(false);
    }
  }

  if (loading || !data) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  const { organization: org, users, agents } = data;

  return (
    <>
      <Link href="/admin/organizations" className={styles.backBtn}>
        <ArrowLeft size={16} />
        Back to Organizations
      </Link>

      {/* Org Header */}
      <div className={styles.orgHeader}>
        <div>
          <h1 className={styles.orgName}>{org.name}</h1>
          <p className={styles.orgMeta}>
            {org.slug} — Created {new Date(org.created_at).toLocaleDateString()}
            {org.trialEndsAt && ` — Trial ends ${new Date(org.trialEndsAt).toLocaleDateString()}`}
          </p>
        </div>
        <div className={styles.orgActions}>
          <span className={`${styles.badge} ${styles[PLAN_BADGE[org.plan] ?? 'badgeFree']}`}>
            {org.plan}
          </span>
          <select
            className={styles.planSelect}
            value={org.plan}
            onChange={(e) => handlePlanChange(e.target.value)}
            disabled={changingPlan}
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteModalOpen(true)}>
            Delete organization
          </Button>
        </div>
      </div>

      <div className={styles.twoCol}>
        {/* Users Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Users size={18} />
            Users ({users.length})
          </h2>
          {users.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>2FA</th>
                  <th>Last Login</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-xs)' }}>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      <span className={`${styles.statusDot} ${u.totpEnabled ? styles.statusDotGreen : styles.statusDotGray}`} />
                      {' '}{u.totpEnabled ? 'On' : 'Off'}
                    </td>
                    <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                    <td>
                      {u.totpEnabled && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={ShieldOff}
                          onClick={() => setReset2FAModal(u)}
                        >
                          Reset
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.emptyState}>No users</p>
          )}
        </div>

        {/* Agents Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Bot size={18} />
            Agents ({agents.length})
          </h2>
          {agents.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>
                      <span className={`${styles.statusDot} ${a.status === 'active' ? styles.statusDotGreen : styles.statusDotGray}`} />
                      {' '}{a.status}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-xs)' }}>{a.llmModel}</td>
                    <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.emptyState}>No agents</p>
          )}
        </div>
      </div>

      {/* Billing Card */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <CreditCard size={18} />
          Billing
        </h2>
        <div className={styles.settingRow}>
          <div className={styles.settingLabel}>Subscription Status</div>
          <div className={styles.settingValue}>
            <span className={`${styles.statusDot} ${org.subscriptionStatus === 'active' ? styles.statusDotGreen : styles.statusDotGray}`} />
            {org.subscriptionStatus}
          </div>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingLabel}>Stripe Customer ID</div>
          <div className={styles.settingValue}>
            <code>{org.stripeCustomerId ?? '—'}</code>
          </div>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingLabel}>Stripe Subscription ID</div>
          <div className={styles.settingValue}>
            <code>{org.stripeSubscriptionId ?? '—'}</code>
          </div>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingLabel}>Current Period</div>
          <div className={styles.settingValue}>
            {org.currentPeriodStart && org.currentPeriodEnd
              ? `${new Date(org.currentPeriodStart).toLocaleDateString()} — ${new Date(org.currentPeriodEnd).toLocaleDateString()}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Delete Organization Modal */}
      <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal} title="Delete organization" size="sm">
        <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
          This permanently deletes <strong>{org.name}</strong> and all its data (agents, conversations,
          contacts, files). This action cannot be undone.
        </p>
        <Input
          label={`Type "${org.name}" to confirm`}
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder={org.name}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <Button variant="secondary" size="sm" onClick={closeDeleteModal} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            loading={deleting}
            disabled={deleteConfirmText.trim().toLowerCase() !== org.name.trim().toLowerCase()}
            onClick={handleDeleteOrg}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>

      {/* Reset 2FA Confirmation Modal */}
      <Modal
        isOpen={!!reset2FAModal}
        onClose={() => setReset2FAModal(null)}
        title="Reset 2FA"
        size="sm"
      >
        <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
          This will disable two-factor authentication and delete all backup codes for{' '}
          <strong>{reset2FAModal?.email}</strong>. The user will need to set up 2FA again.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => setReset2FAModal(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={resetting2FA} onClick={handleReset2FA}>
            Reset 2FA
          </Button>
        </div>
      </Modal>
    </>
  );
}
