import React from 'react';
import styles from './AppButton.module.css';

export type AppButtonVariant = 'primary' | 'secondary';
export type AppButtonSize = 'md' | 'sm';

export interface AppButtonStyleOptions {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  /** Ocupa todo el ancho (por defecto en md). */
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
}

/** Clases del botón, compartidas con `AppButtonLink`. */
export function appButtonClass({ variant = 'primary', size = 'md', fullWidth, loading, className }: AppButtonStyleOptions): string {
  const full = fullWidth ?? size === 'md';
  return [styles.btn, styles[variant], size === 'sm' && styles.sm, full && styles.full, loading && styles.loading, className]
    .filter(Boolean)
    .join(' ');
}

export interface AppButtonProps
  extends AppButtonStyleOptions,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {}

/**
 * Botón de la plataforma nueva. Primario: verde #3DDC84 con tinta oscura (nunca texto blanco).
 * Estados: reposo, hover, foco visible, activo, deshabilitado y carga (`loading`).
 */
export default function AppButton({
  variant,
  size,
  fullWidth,
  loading,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: AppButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={appButtonClass({ variant, size, fullWidth, loading, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
}
