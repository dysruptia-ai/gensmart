import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SiteHref } from '@/lib/site-links';

interface PendingLinkProps {
  /** Ruta de un helper de `resourceLinks` (`null` = sección aún no migrada). */
  href: SiteHref | null;
  className?: string;
  children: ReactNode;
}

/**
 * Enlace a una guía, curso o artículo. Sin ruta se ve igual pero no navega y,
 * al no tener `href`, tampoco entra en el orden de tabulación.
 */
export default function PendingLink({ href, className, children }: PendingLinkProps) {
  if (href) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }
  return (
    <a className={className} aria-disabled="true" data-pending="true">
      {children}
    </a>
  );
}
