'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import PageHero from '../PageHero';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteButton from '../SiteButton';
import SiteLink from '../SiteLink';
import IndustryCards from './IndustryCards';
import IndustryTabs from './IndustryTabs';
import TeamIndexList from './TeamIndexList';
import { SOLUTIONS_CRUMBS, SOLUTIONS_SECTION_IDS } from './solutionsIndex';
import styles from './SolutionsIndexPage.module.css';

const P = 'site.solutions';

/** Índice de Soluciones: industrias y equipos (design/web: `industrias`). */
export default function SolutionsIndexPage() {
  const { t, language } = useTranslation();
  const ids = SOLUTIONS_SECTION_IDS[language === 'en' ? 'en' : 'es'];
  return (
    <>
      <PageHero
        crumbs={SOLUTIONS_CRUMBS}
        title={{ before: t(`${P}.h1.before`), accent: t(`${P}.h1.accent`) }}
        lead={t(`${P}.lead`)}
      />
      <Section surface="dark">
        <Container>
          <SectionHead title={t(`${P}.clockTitle`)} lead={t(`${P}.clockLead`)} />
          <IndustryTabs />
        </Container>
      </Section>
      <Section surface="alt" id={ids.industries}>
        <Container>
          <SectionHead title={t(`${P}.industriesTitle`)} lead={t(`${P}.industriesLead`)} />
          <IndustryCards />
          {/* La landing E-commerce (agente comercial) es distinta de la industria E-commerce */}
          <p className={styles.storeLine}>
            <SiteLink to="ecommerce" className={styles.storeLink}>
              {t(`${P}.ecommerceLine`)} <span aria-hidden="true">→</span>
            </SiteLink>
          </p>
        </Container>
      </Section>
      <Section surface="dark" id={ids.teams}>
        <Container>
          <SectionHead title={t(`${P}.teamsTitle`)} lead={t(`${P}.teamsLead`)} />
          <TeamIndexList />
          <p className={styles.storeLine}>
            <SiteLink to="cases" className={styles.storeLink}>
              {t(`${P}.casesLine`)} <span aria-hidden="true">→</span>
            </SiteLink>
          </p>
        </Container>
      </Section>
      <Section surface="alt">
        <Container className={styles.missing}>
          <SectionHead title={t(`${P}.missingTitle`)} lead={t(`${P}.missingText`)} align="center" />
          <SiteButton to="contact">{t(`${P}.missingCta`)}</SiteButton>
        </Container>
      </Section>
    </>
  );
}
