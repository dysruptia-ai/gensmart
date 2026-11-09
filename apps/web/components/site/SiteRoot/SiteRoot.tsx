import type { ReactNode } from 'react';
import styles from './SiteRoot.module.css';

interface SiteRootProps {
  children: ReactNode;
}

export default function SiteRoot({ children }: SiteRootProps) {
  return <div className={styles.root}>{children}</div>;
}
