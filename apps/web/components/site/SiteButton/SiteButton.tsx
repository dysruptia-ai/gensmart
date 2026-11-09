import type { AnchorHTMLAttributes } from 'react';
import SiteLink from '../SiteLink';
import type { SiteLinkKey } from '@/lib/site-links';
import styles from './SiteButton.module.css';

interface SiteButtonProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: SiteLinkKey;
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'sm' | 'lg';
}

export default function SiteButton({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: SiteButtonProps) {
  const classes = [styles.button, styles[variant], size === 'md' ? '' : styles[size], className]
    .filter(Boolean)
    .join(' ');
  return (
    <SiteLink to={to} className={classes} {...rest}>
      {children}
    </SiteLink>
  );
}
