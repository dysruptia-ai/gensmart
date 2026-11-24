import { ArrowRight } from 'lucide-react';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import SiteLink from '@/components/site/SiteLink';
import { docRouteId } from '@/lib/docs-routes';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import { docById, docCrumbs, docPlans, formatDocDate, prevNext } from './docsContent';
import type { DocData } from './docsData';
import DocFeedback from './DocFeedback';
import DocProse from './DocProse';
import DocToc, { type TocItem } from './DocToc';
import DocsHelp from './DocsHelp';
import DocsSidebar, { DocsMobileMenu } from './DocsSidebar';
import DocsThemeToggle from './DocsThemeToggle';
import shell from './DocsShell.module.css';
import styles from './DocGuidePage.module.css';

const FEEDBACK_ID = 'docs-feedback';

interface DocGuidePageProps {
  doc: DocData;
  lang: SiteLanguage;
}

/** Guía de la base de conocimiento (design/web: `docPage`): barra lateral, contenido y "En esta página". */
export default function DocGuidePage({ doc, lang }: DocGuidePageProps) {
  const t = siteT(lang);
  const plans = docPlans(doc);
  const { prev, next } = prevNext(doc.id);
  const related = doc.next.map(docById);
  const toc: TocItem[] = doc.body.flatMap((b) => (b.kind === 'h2' ? [{ id: b.id[lang], text: b.text[lang] }] : []));
  const hasToc = toc.length > 1;

  return (
    <div className={`${shell.wrap} ${styles.layout} ${hasToc ? styles.withToc : ''}`}>
      <div className={styles.side}>
        <DocsSidebar lang={lang} active={doc.id} />
      </div>

      <div className={styles.main}>
        <DocsMobileMenu lang={lang} active={doc.id} />
        <div className={shell.top}>
          <Breadcrumbs crumbs={docCrumbs(doc, lang)} className={shell.crumbs} />
          <DocsThemeToggle />
        </div>

        <header className={styles.head}>
          <h1>{doc.title[lang]}</h1>
          <p className={styles.lead}>{doc.summary[lang]}</p>
          <div className={styles.meta}>
            <span className={`${styles.type} ${doc.type === 'video' ? styles.typeVideo : ''}`}>
              {t(`site.docs.types.${doc.type}`)}
            </span>
            <span>{t('site.docs.guide.minRead', { n: doc.minutes })}</span>
            <span>
              {t('site.docs.guide.updated')} <time dateTime={doc.updated}>{formatDocDate(doc.updated, lang)}</time>
            </span>
          </div>
          {plans ? (
            <p className={styles.plans}>
              <span>{t('site.docs.guide.plans')}</span>
              {plans.map((plan) => (
                <b key={plan}>{plan}</b>
              ))}
            </p>
          ) : null}
        </header>

        {hasToc ? <DocToc items={toc} variant="inline" /> : null}

        <article className={styles.article}>
          <DocProse body={doc.body} lang={lang} />
        </article>

        <DocFeedback page={doc.id} headingId={FEEDBACK_ID} />

        {related.length ? (
          <section className={styles.related} aria-labelledby="docs-related">
            <h2 id="docs-related">{t('site.docs.guide.related')}</h2>
            <ul>
              {related.map((r) => (
                <li key={r.id}>
                  <SiteLink to={docRouteId(r.id)}>
                    <strong>{r.title[lang]}</strong>
                    <span>{r.summary[lang]}</span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </SiteLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav className={styles.pager} aria-label={t('site.docs.guide.pager')}>
          {prev ? (
            <SiteLink to={docRouteId(prev.id)} rel="prev">
              <small>{t('site.docs.guide.prev')}</small>
              {prev.title[lang]}
            </SiteLink>
          ) : (
            <span />
          )}
          {next ? (
            <SiteLink to={docRouteId(next.id)} rel="next" className={styles.nextLink}>
              <small>{t('site.docs.guide.next')}</small>
              {next.title[lang]}
            </SiteLink>
          ) : (
            <span />
          )}
        </nav>

        <DocsHelp lang={lang} compact />
      </div>

      {hasToc ? (
        <div className={styles.toc}>
          <DocToc items={toc} variant="side" feedbackId={FEEDBACK_ID} />
        </div>
      ) : null}
    </div>
  );
}
