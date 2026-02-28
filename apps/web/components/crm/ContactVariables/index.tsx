import React from 'react';
import { Variable } from 'lucide-react';
import styles from './ContactVariables.module.css';

interface ContactVariablesProps {
  variables: Record<string, unknown>;
}

export default function ContactVariables({ variables }: ContactVariablesProps) {
  const entries = Object.entries(variables ?? {}).filter(
    ([, val]) => val !== null && val !== undefined && val !== ''
  );

  return (
    <div className={styles.card}>
      <div className={styles.titleRow}>
        <Variable size={16} aria-hidden="true" className={styles.icon} />
        <h3 className={styles.title}>
          Captured Variables
          <span className={styles.count}>{entries.length}</span>
        </h3>
      </div>
      {entries.length === 0 ? (
        <p className={styles.empty}>No variables captured yet.</p>
      ) : (
        <div className={styles.list}>
          {entries.map(([key, val]) => (
            <div key={key} className={styles.row}>
              <span className={styles.key}>{key}</span>
              <span className={styles.value}>{String(val ?? '—')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
