import SiteRoot from '../SiteRoot';
import SkipLink from '../SkipLink';
import AnnounceBar from '../AnnounceBar';
import SiteHeader from '../SiteHeader';
import SiteFooter from '../SiteFooter';
import SiteChatWidget from '../SiteChatWidget';
import FinalCtaSection from '../home/FinalCtaSection';
import type { SiteLanguage } from '@/lib/site-routes';
import TeamHero from './TeamHero';
import TeamMethod from './TeamMethod';
import TeamInbox from './TeamInbox';
import TeamIntegrations from './TeamIntegrations';
import TeamChannels from './TeamChannels';
import TeamFaq from './TeamFaq';
import TeamMore from './TeamMore';
import { teamJsonLd } from './teamMeta';
import type { TeamData } from './teamsData';

interface TeamPageProps {
  team: TeamData;
  lang: SiteLanguage;
}

/** Plantilla de las páginas de equipo (design/web: `teamPage` en build.mjs). */
export default function TeamPage({ team, lang }: TeamPageProps) {
  return (
    <SiteRoot>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(teamJsonLd(team, lang)) }}
      />
      <SkipLink />
      <AnnounceBar />
      <SiteHeader />
      <main id="main">
        <TeamHero team={team} />
        <TeamMethod team={team} />
        <TeamInbox team={team} />
        <TeamIntegrations team={team} />
        <TeamChannels />
        <TeamFaq team={team} />
        <TeamMore team={team} />
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}
