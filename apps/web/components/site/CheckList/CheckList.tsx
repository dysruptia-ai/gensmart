import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import styles from './CheckList.module.css';

interface CheckListProps {
  items: ReactNode[];
  className?: string;
  size?: 'sm' | 'md';
}

export default function CheckList({ items, className, size = 'sm' }: CheckListProps) {
  return (
    <ul className={[styles.list, size === 'md' ? styles.md : '', className].filter(Boolean).join(' ')}>
      {items.map((item, i) => (
        <li key={i} className={styles.item}>
          <span className={styles.bullet} aria-hidden="true">
            <Check size={11} strokeWidth={3.5} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
