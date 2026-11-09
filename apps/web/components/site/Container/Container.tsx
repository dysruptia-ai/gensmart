import type { ReactNode } from 'react';
import styles from './Container.module.css';

interface ContainerProps {
  narrow?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function Container({ narrow = false, className, children }: ContainerProps) {
  const classes = [styles.container, narrow ? styles.narrow : '', className]
    .filter(Boolean)
    .join(' ');
  return <div className={classes}>{children}</div>;
}
