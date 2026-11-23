'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import styles from './SiteLink.module.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { SITE_LINKS, resolveSiteHref, type SiteHref, type SiteLinkKey } from '@/lib/site-links';

/**
 * Destino (solo uno): una clave de SITE_LINKS, un ancla dentro de la misma página
 * o una ruta interna ya resuelta por un helper de lib/site-links (p. ej. `registerHref`).
 */
export type SiteLinkTarget =
  | { to: SiteLinkKey; anchor?: never; href?: never }
  | { anchor: `#${string}`; to?: never; href?: never }
  | { href: SiteHref; to?: never; anchor?: never };

export type SiteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  SiteLinkTarget;

export default function SiteLink({
  to,
  anchor,
  href,
  className,
  children,
  onClick,
  ...rest
}: SiteLinkProps) {
  const { language } = useLanguage();

  if (anchor !== undefined) {
    return (
      <a {...rest} className={className} href={anchor} onClick={onClick}>
        {children}
      </a>
    );
  }

  if (href !== undefined) {
    return (
      <Link {...rest} className={className} href={href} onClick={onClick}>
        {children}
      </Link>
    );
  }

  const target = { ...SITE_LINKS[to], href: resolveSiteHref(to, language) };

  if (target.href === null) {
    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onClick?.(e);
    };
    return (
      <a
        {...rest}
        className={[styles.pending, className].filter(Boolean).join(' ')}
        role="link"
        aria-disabled="true"
        tabIndex={0}
        data-pending="true"
        onClick={handleClick}
      >
        {children}
      </a>
    );
  }

  if (target.external) {
    return (
      <a
        {...rest}
        className={className}
        href={target.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link {...rest} className={className} href={target.href} onClick={onClick}>
      {children}
    </Link>
  );
}
