'use client';

import React, { useState } from 'react';
import { Edit2, Save, X, ChevronDown, Trash2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ScoreBadge from '@/components/crm/ScoreBadge';
import styles from './ContactHeader.module.css';

interface ContactHeaderProps {
  contact: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
    ai_score: number | null;
    funnel_stage: string;
    source_channel: string | null;
    tags: string[];
    created_at: string;
  };
  onUpdate: (data: Partial<{ name: string; phone: string; email: string }>) => Promise<void>;
  onStageChange: (stage: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

const STAGES = ['lead', 'opportunity', 'customer'];

export default function ContactHeader({ contact, onUpdate, onStageChange, onDelete }: ContactHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: contact.name ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [stageChanging, setStageChanging] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStageChanging(true);
    try {
      await onStageChange(e.target.value);
    } finally {
      setStageChanging(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const channelVariant = (ch: string | null): 'info' | 'success' =>
    ch === 'whatsapp' ? 'success' : 'info';

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <Avatar
          src={contact.avatar_url ?? undefined}
          name={contact.name ?? 'Unknown'}
          size="xl"
        />
        <div className={styles.meta}>
          <div className={styles.topRow}>
            <ScoreBadge score={contact.ai_score} size="lg" />
            {contact.source_channel && (
              <Badge variant={channelVariant(contact.source_channel)} size="sm">
                {contact.source_channel}
              </Badge>
            )}
          </div>
          <p className={styles.createdAt}>
            Contact since {new Date(contact.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className={styles.actions}>
          {editing ? (
            <>
              <Button size="sm" variant="primary" icon={Save} loading={saving} onClick={handleSave}>
                Save
              </Button>
              <Button size="sm" variant="ghost" icon={X} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" icon={Edit2} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => setShowDeleteModal(true)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className={styles.editForm}>
          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contact name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Phone</label>
            <input
              className={styles.input}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+1234567890"
            />
          </div>
        </div>
      ) : (
        <div className={styles.info}>
          <h2 className={styles.name}>{contact.name ?? 'Unknown Contact'}</h2>
          {contact.email && <p className={styles.infoLine}>{contact.email}</p>}
          {contact.phone && <p className={styles.infoLine}>{contact.phone}</p>}
        </div>
      )}

      <div className={styles.stageRow}>
        <span className={styles.stageLabel}>Stage</span>
        <div className={styles.stageSelectWrap}>
          <select
            className={styles.stageSelect}
            value={contact.funnel_stage}
            onChange={handleStageChange}
            disabled={stageChanging}
            aria-label="Funnel stage"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
        </div>
      </div>

      {contact.tags && contact.tags.length > 0 && (
        <div className={styles.tags}>
          {contact.tags.map((tag, i) => (
            <span key={i} className={styles.tag}>{tag}</span>
          ))}
        </div>
      )}

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Contact"
        size="sm"
      >
        <p className={styles.deleteWarning}>
          Are you sure you want to delete this contact? This action cannot be undone.
          All conversations associated with this contact will also be deleted.
        </p>
        <div className={styles.deleteActions}>
          <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} loading={deleting} onClick={handleDelete}>
            Delete Contact
          </Button>
        </div>
      </Modal>
    </div>
  );
}
