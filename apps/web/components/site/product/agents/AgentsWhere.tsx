'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChannelsStrip from '../../ChannelsStrip';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import { cx } from '../ProductSubpage/cx';
import { subpageValues } from '../ProductSubpage/subpageData';

const W = 'site.productAgents.where';

/** "Dónde vive cada agente": los canales y el enlace a Integraciones. */
export default function AgentsWhere() {
  const { t, language } = useTranslation();
  return (
    <Section surface="alt" rhythm="s">
      <Container>
        <SectionHead title={t(`${W}.title`)} lead={t(`${W}.lead`, subpageValues(language))} />
        <ChannelsStrip label={t(`${W}.label`)} align="start" />
        <p className={cx('cta')}>
          <SiteButton to="integrations" variant="ghost">
            {t(`${W}.cta`)}
          </SiteButton>
        </p>
      </Container>
    </Section>
  );
}
