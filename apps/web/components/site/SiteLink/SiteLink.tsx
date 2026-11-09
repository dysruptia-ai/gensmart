import Link from 'next/link';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import styles from './SiteLink.module.css';
import { SITE_LINKS, type SiteLinkKey } from '@/lib/site-links';

interface SiteLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: SiteLinkKey;
}

export default function SiteLink({ to, className, children, onClick, ...rest }: SiteLinkProps) {
  const target = SITE_LINKS[to];

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
