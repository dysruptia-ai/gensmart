import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rectangle';
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  count?: number;
}

export default function Skeleton({
  variant = 'text',
  width,
  height,
  borderRadius,
  className,
  count = 1,
}: SkeletonProps) {
  const items = Array.from({ length: count });

  const singleStyle: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...(borderRadius ? { borderRadius } : {}),
  };

  if (count === 1) {
    return (
      <div
        className={[styles.skeleton, styles[variant], className ?? ''].filter(Boolean).join(' ')}
        style={singleStyle}
        aria-hidden="true"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {items.map((_, i) => (
        <div
          key={i}
          className={[styles.skeleton, styles[variant], className ?? ''].filter(Boolean).join(' ')}
          style={singleStyle}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
