import type { DocId } from '@gensmart/shared';
import SiteLink from '@/components/site/SiteLink';
import { docRouteId } from '@/lib/docs-routes';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import { ORDERED_GROUPS, docsInGroup } from './docsContent';
import { DocsSearchButton } from './DocsSearch';
import styles from './DocsSidebar.module.css';

interface DocsSidebarProps {
  lang: SiteLanguage;
  /** Guía actual; `null` en el índice (todos los grupos abiertos). */
  active: DocId | null;
}

/** Barra lateral de la base de conocimiento (design/web: `docSide`). */
export default function DocsSidebar({ lang, active }: DocsSidebarProps) {
  const t = siteT(lang);
  return (
    <aside className={styles.side} aria-label={t('site.docs.nav.label')}>
      <DocsSearchButton variant="side" />
      <nav className={styles.nav}>
        <SiteLink
          to="docs"
          className={styles.home}
          aria-current={active === null ? 'page' : undefined}
        >
          {t('site.docs.nav.overview')}
        </SiteLink>
        {ORDERED_GROUPS.map((group) => {
          const docs = docsInGroup(group.id);
          const open = active === null || docs.some((d) => d.id === active);
          return (
            <details key={group.id} className={styles.group} open={open}>
              <summary>
                <span>{group.name[lang]}</span>
                <i>{docs.length}</i>
              </summary>
              <ul>
                {docs.map((doc) => (
                  <li key={doc.id}>
                    <SiteLink to={docRouteId(doc.id)} aria-current={doc.id === active ? 'page' : undefined}>
                      <span>{doc.title[lang]}</span>
                      {doc.type !== 'guide' ? <em>{t(`site.docs.types.${doc.type}`)}</em> : null}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </nav>
    </aside>
  );
}

/** En móvil la barra va dentro de un `details` (design/web: `dxMobile`). */
export function DocsMobileMenu({ lang, active }: DocsSidebarProps) {
  const t = siteT(lang);
  return (
    <details className={styles.mobile}>
      <summary>{t('site.docs.nav.mobile')}</summary>
      <DocsSidebar lang={lang} active={active} />
    </details>
  );
}
