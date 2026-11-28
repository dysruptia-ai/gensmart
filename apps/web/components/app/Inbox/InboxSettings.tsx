'use client';

import React, { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import AssignmentSettings from './AssignmentSettings';
import HoursSettings from './HoursSettings';
import LabelsSettings from './LabelsSettings';
import QuickRepliesSettings from './QuickRepliesSettings';
import AiAssistSettings from './AiAssistSettings';
import type { useInboxSettings } from './useInboxSettings';
import styles from './InboxSettings.module.css';

type SettingsTab = 'assignment' | 'hours' | 'quick-replies' | 'labels';
// El orden del diseño ("Cuándo pide ayuda" va en Entrenamiento)
const TABS: SettingsTab[] = ['assignment', 'hours', 'quick-replies', 'labels'];
const TAB_LABEL: Record<SettingsTab, string> = {
  assignment: 'inbox.settings.assign.tab',
  hours: 'inbox.settings.hours.tab',
  'quick-replies': 'inbox.settings.qr.title',
  labels: 'inbox.labels.title',
};

export interface InboxSettingsProps {
  isManager: boolean;
  userId: string | undefined;
  /** Los ajustes de la bandeja (los mismos que usa la meta de la lista). */
  inbox: ReturnType<typeof useInboxSettings>;
  /** Bajo 1180 px: abre el riel en un cajón. */
  onOpenRail?: () => void;
}

/** Ajustes de la bandeja: Asignación y Horarios y meta (web-45), Respuestas rápidas y Etiquetas (web-43). */
export default function InboxSettings({ isManager, userId, inbox, onOpenRail }: InboxSettingsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: SettingsTab = TABS.includes(raw as SettingsTab) ? (raw as SettingsTab) : 'assignment';
  const tabRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({ assignment: null, hours: null, 'quick-replies': null, labels: null });

  const go = (next: SettingsTab) => router.replace(`/dashboard/conversations/settings?tab=${next}`, { scroll: false });

  function onKey(e: React.KeyboardEvent) {
    const i = TABS.indexOf(tab);
    let next: SettingsTab | null = null;
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length]!;
    if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length]!;
    if (e.key === 'Home') next = TABS[0]!;
    if (e.key === 'End') next = TABS[TABS.length - 1]!;
    if (!next) return;
    e.preventDefault();
    go(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        {onOpenRail && (
          <InboxButton variant="icon" icon={Menu} onClick={onOpenRail} aria-label={t('inbox.list.openRail')} className={styles.menuBtn} />
        )}
        <h1 className={styles.title}>{t('inbox.settings.title')}</h1>
        <p className={styles.subtitle}>{t('inbox.settings.subtitle')}</p>
        <div className={styles.tabs} role="tablist" aria-label={t('inbox.settings.title')} onKeyDown={onKey}>
          {TABS.map((key) => (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[key] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`settings-panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              className={styles.tab}
              onClick={() => go(key)}
            >
              {t(TAB_LABEL[key])}
            </button>
          ))}
        </div>
      </header>
      <div className={styles.body} role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'labels' && <LabelsSettings isManager={isManager} />}
        {tab === 'quick-replies' && (
          <div className={styles.tabStack}>
            <AiAssistSettings data={inbox.data} onSaved={inbox.setData} isManager={isManager} />
            <QuickRepliesSettings isManager={isManager} />
          </div>
        )}
        {(tab === 'assignment' || tab === 'hours') && !inbox.data && (
          <p className={inbox.error ? styles.error : styles.help} role={inbox.error ? 'alert' : 'status'}>
            {inbox.error ? t('inbox.settings.loadError') : t('inbox.settings.loading')}
          </p>
        )}
        {tab === 'assignment' && inbox.data && (
          <AssignmentSettings
            key={JSON.stringify([inbox.data.settings, inbox.data.agentAssignees, inbox.data.team.map((m) => [m.capacity, m.receives])])}
            data={inbox.data}
            onSaved={inbox.setData}
            isManager={isManager}
            userId={userId}
          />
        )}
        {tab === 'hours' && inbox.data && (
          <HoursSettings key={JSON.stringify(inbox.data.settings)} data={inbox.data} onSaved={inbox.setData} isManager={isManager} />
        )}
      </div>
    </div>
  );
}
