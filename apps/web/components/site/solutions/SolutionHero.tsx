'use client';

import { useTranslation } from '@/hooks/useTranslation';
import PageHero from '../PageHero';
import SiteButton from '../SiteButton';
import SolutionHeroChat from './SolutionHeroChat';
import { range, solutionCrumbs, type SolutionData } from './solutionsData';

interface SolutionHeroProps {
  page: SolutionData;
}

/** Hero con foto de fondo, migas, `h1`, subsectores y el chat de ejemplo (design/web: `pageHero` con foto). */
export default function SolutionHero({ page }: SolutionHeroProps) {
  const { t } = useTranslation();
  const k = page.base;
  const after = t(`${k}.h1.after`);
  return (
    <PageHero
      crumbs={solutionCrumbs(page.id)}
      photo={page.photo}
      title={{
        before: t(`${k}.h1.before`),
        accent: t(`${k}.h1.accent`),
        after: after === `${k}.h1.after` || after === '' ? undefined : after,
      }}
      lead={t(`${k}.lead`)}
      subs={page.subs ? range(page.subs).map((i) => t(`${k}.subs.s${i}`)) : undefined}
      actions={
        <>
          <SiteButton to="register" size="lg">
            {t(`${page.common}.primary`)}
          </SiteButton>
          <SiteButton to="contact" variant="ghost" size="lg">
            {t(`${page.common}.demo`)}
          </SiteButton>
        </>
      }
      aside={<SolutionHeroChat page={page} />}
    />
  );
}
