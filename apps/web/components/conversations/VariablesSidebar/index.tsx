'use client';

import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './VariablesSidebar.module.css';

interface AgentVariable {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

interface VariablesSidebarProps {
  capturedVariables: Record<string, unknown>;
  agentVariables?: AgentVariable[];
  contact: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    aiScore: number | null;
    funnelStage: string | null;
  } | null;
}

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--color-text-secondary)';
  if (score >= 7) return 'var(--color-success)';
  if (score >= 4) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export default function VariablesSidebar({
  capturedVariables,
  agentVariables = [],
  contact,
}: VariablesSidebarProps) {
  const { t } = useTranslation();
  const capturedEntries = Object.entries(capturedVariables);

  return (
    <div className={styles.sidebar}>
      {/* Contact info */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('conversations.variables.contact')}</h3>
        {contact ? (
          <div className={styles.contactInfo}>
            <div className={styles.contactAvatar}>
              {contact.name
                ? contact.name
                    .split(' ')
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? '')
                    .join('')
                : '?'}
            </div>
            <div className={styles.contactDetails}>
              <span className={styles.contactName}>{contact.name ?? t('common.name')}</span>
              {contact.phone && <span className={styles.contactMeta}>{contact.phone}</span>}
              {contact.email && <span className={styles.contactMeta}>{contact.email}</span>}
              {contact.funnelStage && (
                <span className={styles.stageBadge}>{contact.funnelStage}</span>
              )}
            </div>
            {contact.aiScore !== null && (
              <div
                className={styles.score}
                style={{ color: scoreColor(contact.aiScore) }}
                title={`AI Score: ${contact.aiScore}/10`}
              >
                {contact.aiScore}
              </div>
            )}
          </div>
        ) : (
          <p className={styles.noContact}>{t('conversations.contactInfo.noContact')}</p>
        )}
      </div>

      {/* Captured variables */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('conversations.variables.title')}</h3>
        {agentVariables.length > 0 ? (
          <ul className={styles.variableList}>
            {agentVariables.map((v) => {
              const captured = capturedVariables[v.name];
              const isCaptured = captured !== undefined && captured !== null && captured !== '';
              return (
                <li key={v.name} className={styles.variableItem}>
                  <span className={styles.variableIcon}>
                    {isCaptured ? (
                      <CheckCircle size={14} color="var(--color-success)" />
                    ) : (
                      <Circle size={14} color={v.required ? 'var(--color-warning)' : 'var(--color-border)'} />
                    )}
                  </span>
                  <div className={styles.variableContent}>
                    <span className={styles.variableName}>
                      {v.name}
                      {v.required && <span className={styles.required}>*</span>}
                    </span>
                    {isCaptured ? (
                      <span className={styles.variableValue}>{String(captured)}</span>
                    ) : (
                      <span className={styles.variablePending}>
                        {v.required ? t('conversations.variables.pending') : t('conversations.variables.notCaptured')}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : capturedEntries.length > 0 ? (
          <ul className={styles.variableList}>
            {capturedEntries.map(([key, value]) => (
              <li key={key} className={styles.variableItem}>
                <span className={styles.variableIcon}>
                  <CheckCircle size={14} color="var(--color-success)" />
                </span>
                <div className={styles.variableContent}>
                  <span className={styles.variableName}>{key}</span>
                  <span className={styles.variableValue}>{String(value)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.noVars}>{t('conversations.variables.noVariables')}</p>
        )}
      </div>
    </div>
  );
}
