'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import AgentConsole from '../AgentConsole';
import Container from '../Container';
import Reveal from '../Reveal';
import Section from '../Section';
import SectionHead from '../SectionHead';
import { solutionConsole, type SolutionData } from './solutionsData';

interface SolutionInboxProps {
  page: SolutionData;
  /** Lead bajo el título (`{common}.inboxLeadScore` o `inboxLeadNoScore`). Las industrias no lo llevan. */
  withLead?: boolean;
}

/** "En la bandeja": la consola con la conversación de la página. */
export default function SolutionInbox({ page, withLead = false }: SolutionInboxProps) {
  const { t } = useSiteTranslation();
  const lead = withLead
    ? t(`${page.common}.${page.score === undefined ? 'inboxLeadNoScore' : 'inboxLeadScore'}`)
    : undefined;
  return (
    <Section surface="alt">
      <Container>
        <SectionHead title={t(`${page.common}.inboxTitle`)} lead={lead} />
        <Reveal>
          <AgentConsole
            example={solutionConsole(page)}
            label={t(`${page.common}.consoleLabel`, { name: t(`${page.base}.console.name`) })}
          />
        </Reveal>
      </Container>
    </Section>
  );
}
