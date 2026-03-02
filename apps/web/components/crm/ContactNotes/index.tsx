'use client';

import React, { useState, useEffect } from 'react';
import { Save, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './ContactNotes.module.css';

interface ContactNotesProps {
  notes: string | null;
  onSave: (notes: string) => Promise<void>;
}

export default function ContactNotes({ notes, onSave }: ContactNotesProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(notes ?? '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(notes ?? '');
    setDirty(false);
  }, [notes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <FileText size={16} aria-hidden="true" className={styles.icon} />
          <h3 className={styles.title}>{t('contacts.detail.notes')}</h3>
        </div>
        {dirty && (
          <Button size="sm" variant="primary" icon={Save} loading={saving} onClick={handleSave}>
            {t('contacts.detail.save')}
          </Button>
        )}
      </div>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={handleChange}
        placeholder={t('contacts.detail.notesPlaceholderFull')}
        rows={4}
      />
    </div>
  );
}
