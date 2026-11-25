'use client';

import { Fragment } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import type { SiteLinkKey } from '@/lib/site-links';
import Container from '../Container';
import SiteButton from '../SiteButton';
import SiteLink from '../SiteLink';
import styles from './NotFoundContent.module.css';

const HELP_LINKS: Record<string, SiteLinkKey> = { blog: 'blog', docs: 'docs', contact: 'contact' };

/** Plantilla `nf` del diseño: "404" decorativo, mensaje, botones y una línea de ayuda. */
export default function NotFoundContent() {
  const { t } = useSiteTranslation();
  // "… el {blog}, la {docs} o {contact}." → texto y enlaces en el orden de cada idioma
  const help = t('site.notFound.help')
    .split(/(\{\w+\})/)
    .map((part, i) => {
      const key = /^\{(\w+)\}$/.exec(part)?.[1];
      const to = key ? HELP_LINKS[key] : undefined;
      if (!key || !to) return <Fragment key={i}>{part}</Fragment>;
      return (
        <SiteLink key={i} to={to} className={styles.helpLink}>
          {t(`site.notFound.${key}`)}
        </SiteLink>
      );
    });

  return (
    <section className={styles.section}>
      <Container className={styles.inner}>
        <div className={styles.fig} aria-hidden="true">
          404
        </div>
        <h1 className={styles.title}>{t('site.notFound.heading')}</h1>
        <p className={styles.lead}>{t('site.notFound.lead')}</p>
        <div className={styles.actions}>
          <SiteButton to="home">{t('site.notFound.home')}</SiteButton>
          <SiteButton to="resources" variant="ghost">
            {t('site.notFound.resources')}
          </SiteButton>
        </div>
        <p className={styles.help}>{help}</p>
      </Container>
    </section>
  );
}
