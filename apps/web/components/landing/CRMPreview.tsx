'use client';

import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './CRMPreview.module.css';

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? styles.scoreHigh
      : score >= 5
      ? styles.scoreMid
      : styles.scoreLow;
  return (
    <span className={`${styles.score} ${color}`} aria-label={`Score: ${score}`}>
      {score}
    </span>
  );
}

export function CRMPreview() {
  const { t } = useTranslation();

  const CONTACTS = [
    { name: 'Sarah Chen', score: 9, stageKey: 'customer', service: 'Enterprise Plan', initial: 'SC' },
    { name: 'Carlos Mendoza', score: 8, stageKey: 'opportunity', service: 'Pro Plan', initial: 'CM' },
    { name: 'Emma Williams', score: 7, stageKey: 'opportunity', service: 'Starter Plan', initial: 'EW' },
    { name: 'James Nguyen', score: 5, stageKey: 'lead', service: 'Free Plan', initial: 'JN' },
  ];

  const FUNNEL_COLS = [
    {
      titleKey: 'lead' as const,
      color: '#6B7280',
      cards: ['James Nguyen', 'Ana García'],
    },
    {
      titleKey: 'opportunity' as const,
      color: '#F59E0B',
      cards: ['Carlos Mendoza', 'Emma Williams'],
    },
    {
      titleKey: 'customer' as const,
      color: '#25D366',
      cards: ['Sarah Chen'],
    },
  ];

  return (
    <section className={styles.section} aria-label="CRM preview">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>{t('landing.crmPreview.eyebrow')}</span>
            <h2 className={styles.title}>{t('landing.crmPreview.title')}</h2>
            <p className={styles.subtitle}>{t('landing.crmPreview.subtitle')}</p>
          </div>
        </ScrollReveal>

        <div className={styles.previews}>
          {/* CRM table */}
          <ScrollReveal delay={100}>
            <div className={styles.tableCard}>
              <div className={styles.cardLabel}>{t('landing.crmPreview.contactList')}</div>
              <table className={styles.table} aria-label="CRM contacts preview">
                <thead>
                  <tr>
                    <th>{t('landing.crmPreview.table.contact')}</th>
                    <th>{t('landing.crmPreview.table.score')}</th>
                    <th>{t('landing.crmPreview.table.stage')}</th>
                    <th>{t('landing.crmPreview.table.service')}</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTACTS.map((c) => (
                    <tr key={c.name}>
                      <td>
                        <div className={styles.contactCell}>
                          <div className={styles.avatar}>{c.initial}</div>
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td>
                        <ScoreBadge score={c.score} />
                      </td>
                      <td>
                        <span className={styles.stage}>{t(`landing.crmPreview.stages.${c.stageKey}`)}</span>
                      </td>
                      <td>
                        <span className={styles.service}>{c.service}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>

          {/* Kanban */}
          <ScrollReveal delay={200}>
            <div className={styles.kanbanCard}>
              <div className={styles.cardLabel}>{t('landing.crmPreview.salesFunnel')}</div>
              <div className={styles.kanban}>
                {FUNNEL_COLS.map((col) => (
                  <div key={col.titleKey} className={styles.kanbanCol}>
                    <div className={styles.kanbanHeader}>
                      <span
                        className={styles.kanbanDot}
                        style={{ background: col.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.kanbanTitle}>{t(`landing.crmPreview.stages.${col.titleKey}`)}</span>
                      <span className={styles.kanbanCount}>{col.cards.length}</span>
                    </div>
                    <div className={styles.kanbanCards}>
                      {col.cards.map((name) => (
                        <div key={name} className={styles.kanbanCardItem}>
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
