import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function Card({
  children,
  padding = 'md',
  hoverable = false,
  onClick,
  className,
}: CardProps) {
  return (
    <div
      className={[
        styles.card,
        styles[padding],
        hoverable || onClick ? styles.hoverable : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {children}
    </div>
  );
}
