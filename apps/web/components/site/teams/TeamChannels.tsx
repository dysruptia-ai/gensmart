'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChannelsStrip from '../ChannelsStrip';
import Container from '../Container';
import Section from '../Section';
import SectionHead from '../SectionHead';
import { COMMON } from './teamsData';

/** "La misma conversación en cualquier canal". */
export default function TeamChannels() {
  const { t } = useTranslation();
  return (
    <Section surface="alt">
      <Container>
        <SectionHead title={t(`${COMMON}.channelsTitle`)} lead={t(`${COMMON}.channelsText`)} />
        <ChannelsStrip label={t(`${COMMON}.channelsLabel`)} align="start" />
      </Container>
    </Section>
  );
}
