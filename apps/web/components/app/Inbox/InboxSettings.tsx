'use client';

import React, { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import LabelsSettings from './LabelsSettings';
import QuickRepliesSettings from './QuickRepliesSettings';
import styles from './InboxSettings.module.css';

type SettingsTab = 'quick-replies' | 'labels';
const TABS: SettingsTab[] = ['quick-replies', 'labels'];

export interface InboxSettingsProps {
  isManager: boolean;
  /** Bajo 1180 px: abre el riel en un cajón. */
  onOpenRail?: () => void;
}

/** Ajustes de la bandeja (web-43): por ahora solo Respuestas rápidas y Etiquetas (las demás pestañas, web-45). */
export default function InboxSettings({ isManager, onOpenRail }: InboxSettingsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: SettingsTab = raw === 'labels' ? 'labels' : 'quick-replies';
  const tabRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({ 'quick-replies': null, labels: null });

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
              {t(key === 'labels' ? 'inbox.labels.title' : 'inbox.settings.qr.title')}
            </button>
          ))}
        </div>
      </header>
      <div className={styles.body} role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'labels' ? <LabelsSettings isManager={isManager} /> : <QuickRepliesSettings isManager={isManager} />}
      </div>
    </div>
  );
}
