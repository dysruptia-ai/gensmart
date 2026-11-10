'use client';

import { useTranslation } from '@/hooks/useTranslation';
import type { SiteLinkKey } from '@/lib/site-links';
import SiteLink from '../SiteLink';
import styles from './SiteLogo.module.css';

interface SiteLogoProps {
  /** 'full' = "GenSmart"; 'mark' = "GS" */
  variant?: 'full' | 'mark';
  tone?: 'onDark' | 'onLight';
  /** Destino del mapa de enlaces; null = sin enlace (span) */
  to?: SiteLinkKey | null;
  ariaLabel?: string;
  /** El tamaño lo define quien lo usa (font-size); por defecto 1em */
  className?: string;
}

/** Logo tipográfico del sitio público (Handjet 700). Independiente del Logo del dashboard. */
export default function SiteLogo({
  variant = 'full',
  tone = 'onDark',
  to = 'home',
  ariaLabel,
  className,
}: SiteLogoProps) {
  const { t } = useTranslation();
  const classes = [styles.logo, tone === 'onLight' ? styles.onLight : styles.onDark, className]
    .filter(Boolean)
    .join(' ');
  const gen = variant === 'mark' ? 'G' : 'Gen';
  const smart = variant === 'mark' ? 'S' : 'Smart';

  const text = (
    <>
      <span className={styles.gen}>{gen}</span>
      <span className={styles.smart}>{smart}</span>
    </>
  );

  if (to === null) {
    return (
      <span className={classes} aria-label={variant === 'mark' ? 'GenSmart' : undefined}>
        {text}
      </span>
    );
  }

  return (
    <SiteLink
      to={to}
      className={classes}
      aria-label={ariaLabel ?? t('site.a11y.logoHome')}
    >
      {text}
    </SiteLink>
  );
}
