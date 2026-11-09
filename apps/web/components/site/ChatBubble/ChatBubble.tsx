import type { ReactNode } from 'react';
import styles from './ChatBubble.module.css';

interface ChatBubbleProps {
  direction: 'in' | 'out';
  /** onGround: para fondos --gs-ground, donde la burbuja entrante usa --gs-panel para contrastar */
  tone?: 'default' | 'onGround';
  children: ReactNode;
  className?: string;
}

export default function ChatBubble({
  direction,
  tone = 'default',
  children,
  className,
}: ChatBubbleProps) {
  const classes = [
    styles.bubble,
    styles[direction],
    direction === 'in' && tone === 'onGround' ? styles.onGround : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={classes}>{children}</div>;
}
