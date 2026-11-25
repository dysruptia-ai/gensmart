'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import SolutionHero from '../solutions/SolutionHero';
import SolutionMethod from '../solutions/SolutionMethod';
import SolutionInbox from '../solutions/SolutionInbox';
import SolutionIntegrations from '../solutions/SolutionIntegrations';
import SolutionChannels from '../solutions/SolutionChannels';
import SolutionFaq from '../solutions/SolutionFaq';
import SolutionMore from '../solutions/SolutionMore';
import { nextThree } from '../solutions/solutionsData';
import TeamControl from './TeamControl';
import { TEAMS, TEAM_COMMON, type TeamData } from './teamsData';

interface TeamPageProps {
  team: TeamData;
}

/** Secciones de una página de equipo (design/web: `teamPage` en build.mjs). */
export default function TeamPage({ team }: TeamPageProps) {
  const { t } = useSiteTranslation();
  return (
    <>
      <SolutionHero page={team} />
      <SolutionMethod page={team}>
        <TeamControl team={team} />
      </SolutionMethod>
      <SolutionInbox page={team} withLead />
      <SolutionIntegrations page={team} withLead />
      <SolutionChannels common={TEAM_COMMON} />
      <SolutionFaq page={team} />
      <SolutionMore title={t(`${TEAM_COMMON}.moreTitle`)} pages={nextThree(TEAMS, team.id)} />
    </>
  );
}
