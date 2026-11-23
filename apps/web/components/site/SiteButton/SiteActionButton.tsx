import type { ButtonHTMLAttributes } from 'react';
import type { SiteButtonLook } from './SiteButton';
import styles from './SiteButton.module.css';

type SiteActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & SiteButtonLook;

/** Mismo aspecto que SiteButton, pero es un <button>: para acciones en la página (abrir un modal…), no para navegar. */
export default function SiteActionButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: SiteActionButtonProps) {
  const classes = [styles.button, styles[variant], size === 'md' ? '' : styles[size], className]
    .filter(Boolean)
    .join(' ');
  return (
    <button {...rest} type="button" className={classes}>
      {children}
    </button>
  );
}
