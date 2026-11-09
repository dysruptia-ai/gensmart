import type { ReactNode } from 'react';
import styles from './SectionHead.module.css';

interface SectionHeadProps {
  title: ReactNode;
  lead?: ReactNode;
  align?: 'start' | 'center';
  className?: string;
}

export default function SectionHead({
  title,
  lead,
  align = 'start',
  className,
}: SectionHeadProps) {
  const classes = [styles.head, align === 'center' ? styles.center : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <h2 className={styles.title}>{title}</h2>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </div>
  );
}
