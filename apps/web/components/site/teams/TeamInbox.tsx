'use client';

import { useTranslation } from '@/hooks/useTranslation';
import AgentConsole from '../AgentConsole';
import Container from '../Container';
import Reveal from '../Reveal';
import Section from '../Section';
import SectionHead from '../SectionHead';
import { COMMON, teamConsole, teamKey, type TeamData } from './teamsData';

interface TeamInboxProps {
  team: TeamData;
}

/** "En la bandeja": la consola con la conversación del equipo. */
export default function TeamInbox({ team }: TeamInboxProps) {
  const { t } = useTranslation();
  const k = teamKey(team.id);
  return (
    <Section surface="alt">
      <Container>
        <SectionHead
          title={t(`${COMMON}.inboxTitle`)}
          lead={t(team.score === undefined ? `${COMMON}.inboxLeadNoScore` : `${COMMON}.inboxLeadScore`)}
        />
        <Reveal>
          <AgentConsole
            example={teamConsole(team)}
            label={t(`${COMMON}.consoleLabel`, { name: t(`${k}.console.name`) })}
          />
        </Reveal>
      </Container>
    </Section>
  );
}
