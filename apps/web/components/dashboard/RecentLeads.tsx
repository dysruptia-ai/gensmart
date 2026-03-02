'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { Star } from 'lucide-react';
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
}

export default function RecentLeads({ leads }: RecentLeadsProps) {
  const router = useRouter();

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Recent High-Score Leads</h2>

      {leads.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No high-score leads yet"
          description="Leads with a score of 5 or above will appear here."
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={`${styles.th} ${styles.centerCol}`}>Score</th>
              <th className={styles.th}>Agent</th>
              <th className={`${styles.th} ${styles.rightCol}`}>Date</th>
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
                    {lead.name ?? lead.email ?? 'Unknown'}
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
                  <span className={styles.date}>{formatDate(lead.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
