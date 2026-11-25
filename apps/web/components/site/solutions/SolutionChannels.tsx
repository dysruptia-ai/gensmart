'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import ChannelsStrip from '../ChannelsStrip';
import Container from '../Container';
import Section from '../Section';
import SectionHead from '../SectionHead';

interface SolutionChannelsProps {
  /** Prefijo de los textos compartidos del grupo. */
  common: string;
}

/** "La misma conversación en cualquier canal". */
export default function SolutionChannels({ common }: SolutionChannelsProps) {
  const { t } = useSiteTranslation();
  return (
    <Section surface="alt">
      <Container>
        <SectionHead title={t(`${common}.channelsTitle`)} lead={t(`${common}.channelsText`)} />
        <ChannelsStrip label={t(`${common}.channelsLabel`)} align="start" />
      </Container>
    </Section>
  );
}
