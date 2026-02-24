import { ScrollReveal } from './ScrollReveal';
import styles from './CRMPreview.module.css';

const CONTACTS = [
  { name: 'Sarah Chen', score: 9, stage: 'Customer', service: 'Enterprise Plan', initial: 'SC' },
  { name: 'Carlos Mendoza', score: 8, stage: 'Opportunity', service: 'Pro Plan', initial: 'CM' },
  { name: 'Emma Williams', score: 7, stage: 'Opportunity', service: 'Starter Plan', initial: 'EW' },
  { name: 'James Nguyen', score: 5, stage: 'Lead', service: 'Free Plan', initial: 'JN' },
];

const FUNNEL_COLS = [
  {
    title: 'Lead',
    color: '#6B7280',
    cards: ['James Nguyen', 'Ana García'],
  },
  {
    title: 'Opportunity',
    color: '#F59E0B',
    cards: ['Carlos Mendoza', 'Emma Williams'],
  },
  {
    title: 'Customer',
    color: '#25D366',
    cards: ['Sarah Chen'],
  },
];

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
  return (
    <section className={styles.section} aria-label="CRM preview">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Built-in CRM</span>
            <h2 className={styles.title}>Smart CRM That Works While You Sleep</h2>
            <p className={styles.subtitle}>
              Every conversation automatically scored, summarized, and organized.
              Your best leads are always front and center.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.previews}>
          {/* CRM table */}
          <ScrollReveal delay={100}>
            <div className={styles.tableCard}>
              <div className={styles.cardLabel}>Contact List</div>
              <table className={styles.table} aria-label="CRM contacts preview">
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Score</th>
                    <th>Stage</th>
                    <th>Service</th>
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
                        <span className={styles.stage}>{c.stage}</span>
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
              <div className={styles.cardLabel}>Sales Funnel</div>
              <div className={styles.kanban}>
                {FUNNEL_COLS.map((col) => (
                  <div key={col.title} className={styles.kanbanCol}>
                    <div className={styles.kanbanHeader}>
                      <span
                        className={styles.kanbanDot}
                        style={{ background: col.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.kanbanTitle}>{col.title}</span>
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
