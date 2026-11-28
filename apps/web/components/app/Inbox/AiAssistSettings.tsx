'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { INBOX_AI } from '@gensmart/shared';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxSwitch from './InboxSwitch';
import type { InboxSettingsResponse } from './useInboxSettings';
import styles from './InboxSettings.module.css';

export interface AiAssistSettingsProps {
  data: InboxSettingsResponse | null;
  onSaved: (next: InboxSettingsResponse) => void;
  isManager: boolean;
}

/**
 * Ajustes › Respuestas rápidas, arriba (web-46): "Resumen y respuestas sugeridas con IA". Se guarda al
 * tocarlo. Miembros: deshabilitado. Solo: bloqueado con el aviso de mejorar de plan.
 */
export default function AiAssistSettings({ data, onSaved, isManager }: AiAssistSettingsProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!data) return null;
  const solo = !data.canTakeOver;
  const enabled = data.settings.aiAssistEnabled ?? true;

  async function toggle(next: boolean) {
    setSaving(true);
    setFailed(false);
    try {
      onSaved(await api.put<InboxSettingsResponse>('/api/inbox-settings', { aiAssistEnabled: next }));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${styles.card} ${styles.cardWide}`} aria-labelledby="ai-assist-title">
      <div className={styles.switchRow}>
        <span>
          <span id="ai-assist-title" className={styles.cardTitle}>
            {t('inbox.settings.ai.title')}
          </span>
          <small id="ai-assist-help">
            {t('inbox.settings.ai.text', { count: INBOX_AI.messagesPerGeneration, n: INBOX_AI.suggestionsCount })}
            {!solo && !isManager && <> {t('inbox.settings.ai.adminOnly')}</>}
          </small>
        </span>
        <InboxSwitch
          checked={!solo && enabled}
          onChange={toggle}
          label={t('inbox.settings.ai.title')}
          describedBy="ai-assist-help"
          disabled={!solo && (!isManager || saving)}
          locked={solo}
        />
      </div>
      {solo && (
        <p className={styles.planNotice} role="status">
          <Lock size={16} aria-hidden="true" />
          <span>
            {t('inbox.settings.ai.solo')}{' '}
            <Link href="/dashboard/billing" className={styles.inlineLink}>
              {t('inbox.thread.soloLink')}
            </Link>
          </span>
        </p>
      )}
      {failed && (
        <p className={styles.error} role="alert">
          {t('inbox.settings.ai.saveError')}
        </p>
      )}
    </section>
  );
}
