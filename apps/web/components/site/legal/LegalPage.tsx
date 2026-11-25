import { Fragment } from 'react';
import Container from '@/components/site/Container';
import PageHero from '@/components/site/PageHero';
import Section from '@/components/site/Section';
import SiteLink from '@/components/site/SiteLink';
import { getLegalDoc, type LegalDoc } from '@/lib/legal';
import { LEGAL_ROUTES } from '@/lib/legal-routes';
import { siteT } from '@/lib/site-i18n';
import { legalHref } from '@/lib/site-links';
import type { SiteLanguage } from '@/lib/site-routes';
import { formatLegalDate, legalCrumbs } from './legalContent';
import styles from './LegalPage.module.css';

interface LegalPageProps {
  doc: LegalDoc;
  lang: SiteLanguage;
}

/** Política de privacidad, Términos o Cookies: el Markdown de `content/legal` con el shell del sitio. */
export default function LegalPage({ doc, lang }: LegalPageProps) {
  const t = siteT(lang);
  const [updatedBefore, updatedAfter = ''] = t('site.legal.lastUpdated').split('{date}');
  // "Esta es una traducción de la {link}…": el enlace en el orden de cada idioma
  const note =
    lang === 'en'
      ? null
      : t('site.legal.translationNote')
          .split(/(\{link\})/)
          .map((part, i) =>
            part === '{link}' ? (
              <SiteLink key={i} href={legalHref(doc.route.routeId, 'en')} hrefLang="en" className={styles.noteLink}>
                {t('site.legal.translationLink')}
              </SiteLink>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            )
          );

  return (
    <>
      <PageHero
        crumbs={legalCrumbs(doc)}
        title={{ before: doc.title }}
        lead={
          <>
            {updatedBefore}
            <time dateTime={doc.lastUpdated}>{formatLegalDate(doc.lastUpdated, lang)}</time>
            {updatedAfter}
          </>
        }
      />
      <Section surface="dark" rhythm="m">
        <Container className={styles.inner}>
          <nav className={styles.others} aria-label={t('site.legal.othersLabel')}>
            <ul>
              {LEGAL_ROUTES.map((l) => (
                <li key={l.id}>
                  <SiteLink
                    to={l.routeId}
                    className={styles.otherLink}
                    aria-current={l.id === doc.id ? 'page' : undefined}
                  >
                    {getLegalDoc(l.id, lang).title}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </nav>
          <article className={styles.prose}>
            {note ? <p className={styles.note}>{note}</p> : null}
            <div dangerouslySetInnerHTML={{ __html: doc.html }} />
          </article>
        </Container>
      </Section>
    </>
  );
}
