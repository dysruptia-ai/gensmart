import React from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getColor(name: string): string {
  const colors = [
    '#25D366', '#128C7E', '#3B82F6', '#8B5CF6',
    '#EC4899', '#F59E0B', '#EF4444', '#10B981',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? '#25D366';
}

export default function Avatar({ src, name = '', size = 'md', className }: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = getColor(name);

  return (
    <div
      className={[styles.avatar, styles[size], className ?? ''].filter(Boolean).join(' ')}
      style={src ? undefined : { backgroundColor: bgColor }}
      aria-label={name || 'Avatar'}
      role="img"
    >
      {src ? (
        <img src={src} alt={name || 'Avatar'} className={styles.img} />
      ) : (
        initials || '?'
      )}
    </div>
  );
}
