import { Fragment } from 'react';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import type { Crumb } from '../Breadcrumbs/crumbs';
import PageHero from '../PageHero';
import SiteLink from '../SiteLink';
import styles from './AboutPage.module.css';

export const aboutCrumbs: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'about', labelKey: 'site.crumbs.about' },
];

const EMAIL = 'hello@gensmart.co';

/** Acerca de: marcador honesto mientras llega el contenido. */
interface AboutPageProps {
  lang: SiteLanguage;
}

export default function AboutPage({ lang }: AboutPageProps) {
  const t = siteT(lang);
  // "… {contact} o escribe a {email}." → enlaces en el orden de cada idioma
  const text = t('site.about.text')
    .split(/(\{contact\}|\{email\})/)
    .map((part, i) => {
      if (part === '{contact}') {
        return (
          <SiteLink key={i} to="contact" className={styles.link}>
            {t('site.about.contact')}
          </SiteLink>
        );
      }
      if (part === '{email}') {
        return (
          <a key={i} href={`mailto:${EMAIL}`} className={styles.link}>
            {EMAIL}
          </a>
        );
      }
      return <Fragment key={i}>{part}</Fragment>;
    });

  return (
    <PageHero
      crumbs={aboutCrumbs}
      title={{ before: t('site.about.h1') }}
      lead={
        <>
          <strong className={styles.soon}>{t('site.about.soon')}</strong> {text}
        </>
      }
    />
  );
}
