'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { Bot } from 'lucide-react';
import styles from './TopAgents.module.css';

interface AgentRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarInitials: string | null;
  status: string;
  conversationCount: number;
  contactCount: number;
  avgScore: number | null;
}

interface TopAgentsProps {
  agents: AgentRow[];
}

function scoreBadgeVariant(score: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (score === null) return 'neutral';
  if (score >= 7) return 'success';
  if (score >= 4) return 'warning';
  return 'danger';
}

export default function TopAgents({ agents }: TopAgentsProps) {
  const router = useRouter();

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Top Agents</h2>

      {agents.length === 0 ? (
        <EmptyState icon={Bot} title="No agents yet" description="Create your first agent to see stats here." />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Agent</th>
              <th className={`${styles.th} ${styles.numCol}`}>Convos</th>
              <th className={`${styles.th} ${styles.numCol}`}>Contacts</th>
              <th className={`${styles.th} ${styles.numCol}`}>Score</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.id}
                className={styles.row}
                onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    router.push(`/dashboard/agents/${agent.id}`);
                  }
                }}
                role="link"
                aria-label={`View agent ${agent.name}`}
              >
                <td className={styles.td}>
                  <span className={styles.agentCell}>
                    <Avatar
                      name={agent.name}
                      src={agent.avatarUrl ?? undefined}
                      size="sm"
                    />
                    <span className={styles.agentName}>{agent.name}</span>
                    {agent.status === 'active' && (
                      <span className={styles.activeDot} aria-label="Active" />
                    )}
                  </span>
                </td>
                <td className={`${styles.td} ${styles.numCol}`}>{agent.conversationCount}</td>
                <td className={`${styles.td} ${styles.numCol}`}>{agent.contactCount}</td>
                <td className={`${styles.td} ${styles.numCol}`}>
                  {agent.avgScore !== null ? (
                    <Badge variant={scoreBadgeVariant(agent.avgScore)}>
                      {agent.avgScore.toFixed(1)}
                    </Badge>
                  ) : (
                    <span className={styles.noScore}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
