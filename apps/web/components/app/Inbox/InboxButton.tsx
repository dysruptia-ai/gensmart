import React from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './InboxButton.module.css';

export interface InboxButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: 'primary' | 'danger' | 'ghost' | 'icon';
  icon?: LucideIcon;
  loading?: boolean;
  /** Esconde el texto en pantallas angostas (queda como aria-label). */
  compactLabel?: boolean;
  /** Solo el ícono a cualquier ancho: el texto queda como aria-label y tooltip. */
  iconOnly?: boolean;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

/** Botón compacto de la Bandeja (34 px): la cabecera del hilo y las franjas no caben con el de 50 px. */
export default function InboxButton({
  variant = 'ghost',
  icon: Icon,
  loading,
  compactLabel,
  iconOnly,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: InboxButtonProps) {
  const text = iconOnly && typeof children === 'string' ? children : undefined;
  return (
    <button
      aria-label={text}
      title={text}
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[styles.btn, styles[variant], compactLabel && styles.compact, iconOnly && styles.iconOnly, className].filter(Boolean).join(' ')}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : Icon && <Icon size={16} aria-hidden="true" />}
      {children !== undefined && <span className={styles.label}>{children}</span>}
    </button>
  );
}
