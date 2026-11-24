import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { solutionJsonLd, solutionMetadata } from '@/components/site/solutions/solutionMeta';
import TeamPage from '@/components/site/teams/TeamPage';
import { TEAM_SLUGS, teamBySlug, type TeamData } from '@/components/site/teams/teamsData';
import { SITE_LANGUAGES, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string; team: string }>;
}

/** Slug desconocido: 404 (no se generan páginas fuera de la lista). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.flatMap((lang) => TEAM_SLUGS.map((team) => ({ lang, team })));
}

async function resolve(params: PageProps['params']): Promise<{ lang: SiteLanguage; team: TeamData }> {
  const { lang, team: slug } = await params;
  const team = teamBySlug(slug);
  if (!isSiteLanguage(lang) || !team) notFound();
  return { lang, team };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, team } = await resolve(params);
  return solutionMetadata(team.id, lang);
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

export default async function TeamSolutionPage({ params }: PageProps) {
  const { lang, team } = await resolve(params);
  return (
    <SolutionShell jsonLd={solutionJsonLd(team, lang)}>
      <TeamPage team={team} />
    </SolutionShell>
  );
}
