import { ArrowRight, Inbox, Plug, Zap, type LucideIcon } from 'lucide-react';
import type { DocId } from '@gensmart/shared';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import SiteLink from '@/components/site/SiteLink';
import { docRouteId } from '@/lib/docs-routes';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import { DOCS_INDEX_CRUMBS, ORDERED_GROUPS, docById, docsInGroup } from './docsContent';
import type { DocGroupData } from './docsData';
import DocsHelp from './DocsHelp';
import { DocsSearchButton } from './DocsSearch';
import DocsThemeToggle from './DocsThemeToggle';
import shell from './DocsShell.module.css';
import styles from './DocsIndexPage.module.css';

/** Guías esenciales, en orden (design/web: `DX_ESSENTIAL`). */
const ESSENTIAL: readonly DocId[] = ['primer-agente', 'conectar-whatsapp', 'base-de-conocimiento', 'probar-antes', 'traspaso', 'bandeja'];

/** Búsquedas sugeridas: enlazan directo a su guía. */
const CHIPS: readonly { key: string; doc: DocId }[] = [
  { key: 'whatsapp', doc: 'conectar-whatsapp' },
  { key: 'knowledge', doc: 'base-de-conocimiento' },
  { key: 'handoff', doc: 'traspaso' },
  { key: 'test', doc: 'probar-antes' },
];

const GROUP_ICONS: Record<DocGroupData['icon'], LucideIcon> = { zap: Zap, inbox: Inbox, plug: Plug };

interface DocsIndexPageProps {
  lang: SiteLanguage;
}

/** Índice de la base de conocimiento, "Centro de ayuda" (design/web: `docs`). */
export default function DocsIndexPage({ lang }: DocsIndexPageProps) {
  const t = siteT(lang);
  return (
    <>
      <section className={styles.hero}>
        <div className={shell.wrap}>
          <div className={shell.top}>
            <Breadcrumbs crumbs={DOCS_INDEX_CRUMBS} className={shell.crumbs} />
            <DocsThemeToggle />
          </div>
          <h1 className={styles.title}>
            {t('site.docs.hub.titleBefore')}
            <span className={styles.hl}>{t('site.docs.hub.titleHl')}</span>
            {t('site.docs.hub.titleAfter')}
          </h1>
          <p className={styles.lead}>{t('site.docs.hub.lead')}</p>
          <DocsSearchButton variant="hero" />
          <div className={styles.chips}>
            <span id="docs-suggested">{t('site.docs.hub.suggested')}</span>
            <ul aria-labelledby="docs-suggested">
              {CHIPS.map((chip) => (
                <li key={chip.key}>
                  <SiteLink to={docRouteId(chip.doc)}>{t(`site.docs.hub.chips.${chip.key}`)}</SiteLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className={`${shell.wrap} ${styles.body}`}>
        <section className={styles.block} aria-labelledby="docs-ess">
          <div className={styles.head}>
            <h2 id="docs-ess">{t('site.docs.hub.essTitle')}</h2>
            <p>{t('site.docs.hub.essLead')}</p>
          </div>
          <ol className={styles.essential}>
            {ESSENTIAL.map(docById).map((doc, i) => (
              <li key={doc.id}>
                <SiteLink to={docRouteId(doc.id)}>
                  <i aria-hidden="true">{String(i + 1).padStart(2, '0')}</i>
                  <span>
                    <strong>{doc.title[lang]}</strong>
                    <small>{t('site.docs.hub.min', { n: doc.minutes })}</small>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </SiteLink>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.block} aria-labelledby="docs-cats">
          <div className={styles.head}>
            <h2 id="docs-cats">{t('site.docs.hub.catsTitle')}</h2>
          </div>
          <div className={styles.cards}>
            {ORDERED_GROUPS.map((group) => {
              const docs = docsInGroup(group.id);
              const Icon = GROUP_ICONS[group.icon];
              return (
                <article key={group.id} className={styles.card}>
                  <span className={styles.icon} aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <h3>{group.name[lang]}</h3>
                  <p>{group.desc[lang]}</p>
                  <ul>
                    {docs.map((doc) => (
                      <li key={doc.id}>
                        <SiteLink to={docRouteId(doc.id)}>
                          <span>{doc.title[lang]}</span>
                          {doc.type === 'video' ? <em>{t('site.docs.types.video')}</em> : null}
                        </SiteLink>
                      </li>
                    ))}
                  </ul>
                  <small>
                    {docs.length === 1 ? t('site.docs.hub.guideOne') : t('site.docs.hub.guides', { n: docs.length })}
                  </small>
                </article>
              );
            })}
          </div>
        </section>

        <DocsHelp lang={lang} />
      </div>
    </>
  );
}
