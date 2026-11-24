'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SiteLink from '../SiteLink';
import type { Crumb } from './crumbs';
import styles from './Breadcrumbs.module.css';

interface BreadcrumbsProps {
  /** De la raíz a la página actual; la última no enlaza y lleva `aria-current`. */
  crumbs: readonly Crumb[];
  className?: string;
}

export default function Breadcrumbs({ crumbs, className }: BreadcrumbsProps) {
  const { t } = useTranslation();
  const last = crumbs.length - 1;
  return (
    <nav aria-label={t('site.crumbs.label')} className={className}>
      <ol className={styles.crumbs}>
        {crumbs.map((crumb, i) =>
          i === last ? (
            <li key={crumb.labelKey} aria-current="page">
              {t(crumb.labelKey)}
            </li>
          ) : (
            <li key={crumb.labelKey}>
              {crumb.id ? <SiteLink to={crumb.id}>{t(crumb.labelKey)}</SiteLink> : t(crumb.labelKey)}
            </li>
          )
        )}
      </ol>
    </nav>
  );
}
