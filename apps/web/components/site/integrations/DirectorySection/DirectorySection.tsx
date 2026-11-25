'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import LogoTile, { BRAND_LOGOS } from '../../LogoTile';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import { toolsCount } from '../../product/productData';
import { TOOL_CATEGORIES, categoryTitle } from '../integrationsData';
import styles from './DirectorySection.module.css';

const D = 'site.integrations.dir';

/** Directorio por categoría (design/web: `.int-dir`), como listas semánticas. */
export default function DirectorySection() {
  const { t, language } = useSiteTranslation();
  return (
    <Section id="directorio" surface="alt" rhythm="l">
      <Container>
        <SectionHead title={t(`${D}.title`)} lead={t(`${D}.lead`)} />
        <div className={styles.dir}>
          {TOOL_CATEGORIES.map((cat) => {
            const title = categoryTitle(t, cat.key);
            return (
              <section key={cat.key} className={styles.group} aria-labelledby={`dir-${cat.key}`}>
                <div className={styles.copy}>
                  <h3 id={`dir-${cat.key}`}>{title}</h3>
                  <p>{t(`${D}.${cat.key}Desc`)}</p>
                </div>
                <ul className={styles.logos} aria-label={t(`${D}.toolsLabel`, { category: title })}>
                  {cat.tools.map((name) => {
                    const logo = BRAND_LOGOS[name];
                    return logo ? (
                      <li key={name}>
                        <LogoTile logo={logo} size="md" interactive className={styles.tile} />
                      </li>
                    ) : null;
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <p className={styles.more}>
          <strong>{t(`${D}.moreTitle`)}</strong> {t(`${D}.moreText`, { tools: toolsCount(language) })}
        </p>
        <div className={styles.actions}>
          <SiteButton to="contact">{t(`${D}.talk`)}</SiteButton>
          <SiteButton to="docs" variant="ghost">
            {t(`${D}.docs`)}
          </SiteButton>
        </div>
      </Container>
    </Section>
  );
}
