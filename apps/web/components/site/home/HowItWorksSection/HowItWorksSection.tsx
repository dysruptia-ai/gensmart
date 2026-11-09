'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import Reveal from '../../Reveal';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import AgentConsole from './AgentConsole';
import StepBuilder from './StepBuilder';
import styles from './HowItWorksSection.module.css';

export default function HowItWorksSection() {
  const { t } = useTranslation();
  return (
    <Section id="como" surface="dark" className={styles.how}>
      <Container>
        <SectionHead title={t('site.home.how.title')} lead={t('site.home.how.lead')} />
        <StepBuilder />
        <Reveal>
          <AgentConsole />
        </Reveal>
        <div className={styles.actions}>
          <SiteButton to="register">{t('site.home.how.ctaPrimary')}</SiteButton>
          <SiteButton to="contact" variant="ghost">
            {t('site.home.how.ctaDemo')}
          </SiteButton>
        </div>
      </Container>
    </Section>
  );
}
