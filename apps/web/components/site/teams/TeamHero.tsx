'use client';

import { useTranslation } from '@/hooks/useTranslation';
import PageHero from '../PageHero';
import SiteButton from '../SiteButton';
import TeamHeroChat from './TeamHeroChat';
import { COMMON, teamCrumbs, teamKey, type TeamData } from './teamsData';

interface TeamHeroProps {
  team: TeamData;
}

/** Hero con foto de fondo, migas, `h1` y el chat de ejemplo (design/web: `pageHero` con `tm.img`). */
export default function TeamHero({ team }: TeamHeroProps) {
  const { t } = useTranslation();
  const k = teamKey(team.id);
  const after = t(`${k}.h1.after`);
  return (
    <PageHero
      crumbs={teamCrumbs(team.id)}
      photo={team.photo}
      title={{
        before: t(`${k}.h1.before`),
        accent: t(`${k}.h1.accent`),
        after: after === `${k}.h1.after` || after === '' ? undefined : after,
      }}
      lead={t(`${k}.lead`)}
      actions={
        <>
          <SiteButton to="register" size="lg">
            {t(`${COMMON}.primary`)}
          </SiteButton>
          <SiteButton to="contact" variant="ghost" size="lg">
            {t(`${COMMON}.demo`)}
          </SiteButton>
        </>
      }
      aside={<TeamHeroChat team={team} />}
    />
  );
}
