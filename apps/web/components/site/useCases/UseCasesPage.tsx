'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import PageHero from '../PageHero';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteButton from '../SiteButton';
import JobTabs from './JobTabs';
import UseCasesLimits from './UseCasesLimits';
import UseCasesPicker from './UseCasesPicker';
import { U, USE_CASES_CRUMBS } from './useCasesData';
import styles from './UseCasesPage.module.css';

/** Casos de uso: los 6 trabajos del agente y lo que queda para tu equipo (design/web: `casos`). */
export default function UseCasesPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHero
        crumbs={USE_CASES_CRUMBS}
        title={{ before: t(`${U}.hero.titleBefore`), accent: t(`${U}.hero.titleAccent`) }}
        lead={t(`${U}.hero.lead`)}
        actions={
          <>
            <SiteButton to="register">{t(`${U}.hero.primary`)}</SiteButton>
            <SiteButton to="industries" variant="ghost">
              {t(`${U}.hero.secondary`)}
            </SiteButton>
          </>
        }
      />
      <Section surface="dark" rhythm="l">
        <Container>
          <JobTabs />
        </Container>
      </Section>
      <Section surface="alt">
        <Container>
          <SectionHead title={t(`${U}.limits.title`)} lead={t(`${U}.limits.lead`)} />
          <UseCasesLimits />
        </Container>
      </Section>
      <Section surface="dark">
        <Container>
          <SectionHead title={t(`${U}.go.title`)} lead={t(`${U}.go.lead`)} />
          <UseCasesPicker />
        </Container>
      </Section>
      <Section surface="alt">
        <Container className={styles.story}>
          <SectionHead title={t(`${U}.story.title`)} lead={t(`${U}.story.lead`)} align="center" />
          <SiteButton to="contact" variant="ghost">
            {t(`${U}.story.cta`)}
          </SiteButton>
        </Container>
      </Section>
    </>
  );
}
