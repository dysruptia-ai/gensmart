'use client';

import ChannelsStrip from '../../ChannelsStrip';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import type { SectionRhythm, SectionSurface } from '../../Section/Section';

interface ChannelsSectionProps {
  title: string;
  lead: string;
  /** Nombre accesible de la lista de canales. */
  label: string;
  surface?: SectionSurface;
  rhythm?: SectionRhythm;
}

/** Sección "los seis canales" de las subpáginas: título, lead y `ChannelsStrip`. */
export default function ChannelsSection({ title, lead, label, surface = 'alt', rhythm = 'l' }: ChannelsSectionProps) {
  return (
    <Section surface={surface} rhythm={rhythm}>
      <Container>
        <SectionHead title={title} lead={lead} />
        <ChannelsStrip label={label} align="start" />
      </Container>
    </Section>
  );
}
