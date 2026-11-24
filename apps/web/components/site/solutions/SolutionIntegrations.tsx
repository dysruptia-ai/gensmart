'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import LogoTile from '../LogoTile';
import { BRAND_LOGOS } from '../LogoTile/logoData';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteLink from '../SiteLink';
import type { SolutionData } from './solutionsData';
import styles from './SolutionIntegrations.module.css';

interface SolutionIntegrationsProps {
  page: SolutionData;
  /** Lead bajo el título (`{common}.intsLead`). Las industrias no lo llevan. */
  withLead?: boolean;
}

/** Integraciones de la página (design/web: `.logo-strip.ints-strip`). */
export default function SolutionIntegrations({ page, withLead = false }: SolutionIntegrationsProps) {
  const { t } = useTranslation();
  const lead = withLead ? t(`${page.common}.intsLead`) : undefined;
  return (
    <Section surface="dark">
      <Container>
        <SectionHead title={t(`${page.common}.intsTitle`)} lead={lead} />
        <ul
          className={styles.strip}
          aria-label={t(`${page.common}.intsListLabel`, { name: t(`${page.base}.name`) })}
        >
          {page.integrations.map((name) => {
            const logo = BRAND_LOGOS[name];
            return logo ? (
              <li key={name}>
                <LogoTile logo={logo} className={styles.tile} />
              </li>
            ) : null;
          })}
        </ul>
        <p className={styles.more}>
          {t(`${page.common}.intsOther`)}{' '}
          <SiteLink to="integrations" className={styles.link}>
            {t(`${page.common}.intsLink`)} <span aria-hidden="true">→</span>
          </SiteLink>
        </p>
      </Container>
    </Section>
  );
}
