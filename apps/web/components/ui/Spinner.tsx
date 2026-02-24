import React from 'react';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export default function Spinner({ size = 'md', color, className }: SpinnerProps) {
  return (
    <div
      className={[styles.spinner, styles[size], className ?? ''].filter(Boolean).join(' ')}
      style={color ? { borderTopColor: color } : undefined}
      role="status"
      aria-label="Loading"
    />
  );
}
