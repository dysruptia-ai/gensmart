'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { Star } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDate } from '@/lib/formatters';
import styles from './RecentLeads.module.css';

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  score: number | null;
  service: string | null;
  createdAt: string;
  agentName: string | null;
  agentId: string | null;
}

interface RecentLeadsProps {
  leads: Lead[];
}

function scoreBadgeVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 7) return 'success';
  if (score >= 4) return 'warning';
  return 'danger';
}

export default function RecentLeads({ leads }: RecentLeadsProps) {
  const router = useRouter();
  const { t, language } = useTranslation();

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{t('dashboard.recentLeads.title')}</h2>

      {leads.length === 0 ? (
        <EmptyState
          icon={Star}
          title={t('dashboard.recentLeads.noLeads')}
          description={t('contacts.empty.description')}
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>{t('dashboard.recentLeads.name')}</th>
              <th className={`${styles.th} ${styles.centerCol}`}>{t('dashboard.recentLeads.score')}</th>
              <th className={styles.th}>{t('dashboard.recentLeads.agent')}</th>
              <th className={`${styles.th} ${styles.rightCol}`}>{t('dashboard.recentLeads.date')}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className={styles.row}
                onClick={() => router.push(`/dashboard/contacts/${lead.id}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    router.push(`/dashboard/contacts/${lead.id}`);
                  }
                }}
                role="link"
                aria-label={`View lead ${lead.name ?? lead.email ?? lead.id}`}
              >
                <td className={styles.td}>
                  <span className={styles.leadName}>
                    {lead.name ?? lead.email ?? t('common.name')}
                  </span>
                  {lead.service && (
                    <span className={styles.service}>{lead.service}</span>
                  )}
                </td>
                <td className={`${styles.td} ${styles.centerCol}`}>
                  {lead.score !== null && (
                    <Badge variant={scoreBadgeVariant(lead.score)}>
                      {lead.score}/10
                    </Badge>
                  )}
                </td>
                <td className={styles.td}>
                  <span className={styles.agentName}>
                    {lead.agentName ?? '—'}
                  </span>
                </td>
                <td className={`${styles.td} ${styles.rightCol}`}>
                  <span className={styles.date}>{formatDate(lead.createdAt, language)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
