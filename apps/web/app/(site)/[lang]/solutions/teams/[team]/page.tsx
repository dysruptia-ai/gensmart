import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import TeamPage from '@/components/site/teams/TeamPage';
import { teamMetadata } from '@/components/site/teams/teamMeta';
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
  return teamMetadata(team, lang);
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

export default async function TeamSolutionPage({ params }: PageProps) {
  const { lang, team } = await resolve(params);
  return <TeamPage team={team} lang={lang} />;
}
