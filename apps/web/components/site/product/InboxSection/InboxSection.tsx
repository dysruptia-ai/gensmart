'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import AgentConsole, { type ConsoleExample } from '../../AgentConsole';
import Container from '../../Container';
import Reveal from '../../Reveal';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import styles from './InboxSection.module.css';

const I = 'site.product.inbox';

/**
 * Ejemplo de Producto: Valentina Ruiz, agente de reservas, cita agendada.
 * El texto se ajusta a lo que hace la plataforma: confirmación por correo con enlace
 * a Google Calendar (si el contacto tiene correo) y sin recordatorio al cliente.
 */
const BOOKING_EXAMPLE: ConsoleExample = {
  initials: 'VR',
  nameKey: `${I}.name`,
  metaKey: `${I}.meta`,
  summaryKey: `${I}.summary`,
  bubbles: [
    { key: `${I}.b1`, out: false },
    { key: `${I}.b2`, out: true },
    { key: `${I}.b3`, out: false },
    { key: `${I}.b4`, out: true },
  ],
  score: 8.4,
  data: [
    { labelKey: 'site.home.how.leadChannel', valueKey: 'site.home.how.leadChannelValue' },
    { labelKey: 'site.home.how.leadStage', valueKey: `${I}.stageValue` },
  ],
  didKeys: [`${I}.did1`, `${I}.did2`, `${I}.did3`, `${I}.did4`],
};

export default function InboxSection() {
  const { t } = useSiteTranslation();
  return (
    <Section id="bandeja" surface="alt" rhythm="l">
      <Container>
        <SectionHead title={t(`${I}.title`)} lead={t(`${I}.lead`)} />
        <Reveal>
          <AgentConsole example={BOOKING_EXAMPLE} />
        </Reveal>
        <ul className={styles.trio}>
          {[1, 2, 3].map((i) => (
            <li key={i}>
              <h3>{t(`${I}.t${i}`)}</h3>
              <p>{t(`${I}.t${i}Desc`)}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
