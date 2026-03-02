'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, MoreVertical, Trash2, Shield } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Dropdown from '@/components/ui/Dropdown';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../settings.module.css';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

type RoleVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const ROLE_VARIANTS: Record<string, RoleVariant> = {
  owner: 'info',
  admin: 'warning',
  member: 'neutral',
};

export default function TeamSettingsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      const data = await api.get<Member[]>('/api/organization/members');
      setMembers(data);
    } catch {
      toastError(t('settings.team.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [toastError, t]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('/api/organization/members/invite', { email: inviteEmail, role: inviteRole });
      success(t('settings.team.inviteSent'), `${inviteEmail} will receive an email to join.`);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('member');
      await loadMembers();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('settings.team.inviteFailed'));
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(member: Member) {
    setRemoving(true);
    try {
      await api.delete(`/api/organization/members/${member.id}`);
      success(t('settings.team.memberRemoved'));
      setConfirmRemove(null);
      await loadMembers();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('settings.team.removeFailed'));
    } finally {
      setRemoving(false);
    }
  }

  async function handleChangeRole(member: Member, newRole: 'admin' | 'member') {
    try {
      await api.put(`/api/organization/members/${member.id}/role`, { role: newRole });
      success(t('settings.team.roleUpdated'));
      await loadMembers();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('settings.team.roleFailed'));
    }
  }

  const isOwner = user?.role === 'owner';

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className={styles.pageTitle}>{t('settings.team.title')}</h1>
          <p className={styles.pageDesc}>{t('settings.team.description')}</p>
        </div>
        {isOwner && (
          <Button icon={UserPlus} onClick={() => setInviteOpen(true)} size="sm">
            {t('settings.team.inviteMember')}
          </Button>
        )}
      </div>

      <section className={styles.section}>
        {loading ? (
          <div className={styles.loadingWrapper}><Spinner size="md" /></div>
        ) : (
          members.map((member) => (
            <div key={member.id} className={styles.memberRow}>
              <Avatar name={member.name} size="sm" />
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>{member.name}</div>
                <div className={styles.memberEmail}>{member.email}</div>
              </div>
              <Badge variant={ROLE_VARIANTS[member.role] ?? 'secondary'} size="sm">
                {member.role}
              </Badge>
              {isOwner && member.id !== user?.id && member.role !== 'owner' && (
                <div className={styles.memberActions}>
                  <Dropdown
                    trigger={
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius-sm)' }}
                        aria-label="Member actions"
                      >
                        <MoreVertical size={16} />
                      </button>
                    }
                    items={[
                      {
                        label: member.role === 'admin' ? t('settings.team.changeToMember') : t('settings.team.changeToAdmin'),
                        icon: Shield,
                        onClick: () => handleChangeRole(member, member.role === 'admin' ? 'member' : 'admin'),
                      },
                      {
                        label: t('settings.team.removeMember'),
                        icon: Trash2,
                        danger: true,
                        dividerBefore: true,
                        onClick: () => setConfirmRemove(member),
                      },
                    ]}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteEmail(''); }}
        title={t('settings.team.inviteTitle')}
        size="sm"
      >
        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label={t('settings.team.emailLabel')}
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
            autoFocus
          />
          <div>
            <label htmlFor="invite-role" style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>
              {t('settings.team.roleLabel')}
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
            >
              <option value="member">{t('settings.team.roles.memberDesc')}</option>
              <option value="admin">{t('settings.team.roles.adminDesc')}</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setInviteOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={inviting} icon={UserPlus}>{t('settings.team.sendInvite')}</Button>
          </div>
        </form>
      </Modal>

      {/* Remove Confirmation */}
      <Modal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title={t('settings.team.removeTitle')}
        size="sm"
      >
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          {t('settings.team.removeConfirm', { name: confirmRemove?.name ?? '' })}
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
