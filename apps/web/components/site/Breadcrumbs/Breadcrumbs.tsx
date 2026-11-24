'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SiteLink from '../SiteLink';
import { crumbLabel, type Crumb } from './crumbs';
import styles from './Breadcrumbs.module.css';

interface BreadcrumbsProps {
  /** De la raíz a la página actual; la última no enlaza y lleva `aria-current`. */
  crumbs: readonly Crumb[];
  className?: string;
  /**
   * La última miga también enlaza (sin `aria-current`): para páginas que no se nombran
   * en las migas, como un artículo del blog (Inicio / Blog / {Categoría}).
   */
  linkLast?: boolean;
}

export default function Breadcrumbs({ crumbs, className, linkLast = false }: BreadcrumbsProps) {
  const { t } = useTranslation();
  const last = linkLast ? -1 : crumbs.length - 1;
  return (
    <nav aria-label={t('site.crumbs.label')} className={className}>
      <ol className={styles.crumbs}>
        {crumbs.map((crumb, i) =>
          i === last ? (
            <li key={crumb.labelKey} aria-current="page">
              {crumbLabel(crumb, t)}
            </li>
          ) : (
            <li key={crumb.labelKey}>
              {crumb.id ? <SiteLink to={crumb.id}>{crumbLabel(crumb, t)}</SiteLink> : crumbLabel(crumb, t)}
            </li>
          )
        )}
      </ol>
    </nav>
  );
}
