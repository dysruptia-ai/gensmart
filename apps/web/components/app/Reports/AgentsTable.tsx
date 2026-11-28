'use client';

import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { InboxReport } from './types';
import styles from './AgentsTable.module.css';

export interface AgentsTableProps {
  agents: InboxReport['agents'];
  /** "Hoy", "7 días", "30 días": va en el encabezado de la columna de conversaciones. */
  periodLabel: string;
}

/** La tabla de agentes; en menos de 768 px, una tarjeta por agente (sin scroll horizontal). */
export default function AgentsTable({ agents, periodLabel }: AgentsTableProps) {
  const { t } = useTranslation();
  if (agents.length === 0) return <p className={styles.empty}>{t('reports.agents.empty')}</p>;
  const convHeader = t('reports.agents.conversations', { period: periodLabel });
  const alone = (a: InboxReport['agents'][number]) =>
    a.resolvedAlonePct === null ? String(a.resolvedAlone) : `${a.resolvedAlone} (${Math.round(a.resolvedAlonePct)} %)`;
  const tag = (a: InboxReport['agents'][number]) => (
    <span className={`${styles.tag} ${styles[a.status]}`}>{t(`reports.agents.${a.status}`)}</span>
  );
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('reports.agents.agent')}</th>
            <th scope="col">{convHeader}</th>
            <th scope="col">{t('reports.agents.resolvedAlone')}</th>
            <th scope="col">{t('reports.agents.askedHelp')}</th>
            <th scope="col">{t('reports.agents.status')}</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.agentId}>
              <th scope="row">{a.name}</th>
              <td>{a.conversations}</td>
              <td>{alone(a)}</td>
              <td>{a.askedHelp}</td>
              <td>{tag(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className={styles.cards}>
        {agents.map((a) => (
          <li key={a.agentId} className={styles.card}>
            <div className={styles.cardHead}>
              <b>{a.name}</b>
              {tag(a)}
            </div>
            <dl className={styles.kv}>
              <div>
                <dt>{convHeader}</dt>
                <dd>{a.conversations}</dd>
              </div>
              <div>
                <dt>{t('reports.agents.resolvedAlone')}</dt>
                <dd>{alone(a)}</dd>
              </div>
              <div>
                <dt>{t('reports.agents.askedHelp')}</dt>
                <dd>{a.askedHelp}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
