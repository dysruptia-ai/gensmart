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
      toastError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('/api/organization/members/invite', { email: inviteEmail, role: inviteRole });
      success('Invitation sent!', `${inviteEmail} will receive an email to join.`);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('member');
      await loadMembers();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(member: Member) {
    setRemoving(true);
    try {
      await api.delete(`/api/organization/members/${member.id}`);
      success('Member removed');
      setConfirmRemove(null);
      await loadMembers();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to remove member');
    } finally {
      setRemoving(false);
    }
  }

  async function handleChangeRole(member: Member, newRole: 'admin' | 'member') {
    try {
      await api.put(`/api/organization/members/${member.id}/role`, { role: newRole });
      success('Role updated');
      await loadMembers();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to update role');
    }
  }

  const isOwner = user?.role === 'owner';

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className={styles.pageTitle}>Team Members</h1>
          <p className={styles.pageDesc}>Manage who has access to your workspace.</p>
        </div>
        {isOwner && (
          <Button icon={UserPlus} onClick={() => setInviteOpen(true)} size="sm">
            Invite Member
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
                        label: member.role === 'admin' ? 'Change to Member' : 'Change to Admin',
                        icon: Shield,
                        onClick: () => handleChangeRole(member, member.role === 'admin' ? 'member' : 'admin'),
                      },
                      {
                        label: 'Remove Member',
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
        title="Invite Team Member"
        size="sm"
      >
        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Email address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
            autoFocus
          />
          <div>
            <label htmlFor="invite-role" style={{ display: 'block', fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>
              Role
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
            >
              <option value="member">Member — Use agents, view CRM</option>
              <option value="admin">Admin — Manage agents, team, CRM</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit" loading={inviting} icon={UserPlus}>Send Invite</Button>
          </div>
        </form>
      </Modal>

      {/* Remove Confirmation */}
      <Modal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove Member"
        size="sm"
      >
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          Are you sure you want to remove <strong>{confirmRemove?.name}</strong> from the team?
          They will lose access immediately.
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
