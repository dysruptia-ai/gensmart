'use client';

import { useTranslation } from '@/hooks/useTranslation';
import FaqSection from '../FaqSection';
import SiteButton from '../SiteButton';
import { COMMON, teamFaqItems, teamKey, type TeamData } from './teamsData';

interface TeamFaqProps {
  team: TeamData;
}

/** Mismo texto que el JSON-LD `FAQPage` de la página (`teamFaqItems`). */
export default function TeamFaq({ team }: TeamFaqProps) {
  const { t } = useTranslation();
  return (
    <FaqSection
      headingId="faq-heading"
      kicker={t(`${COMMON}.faqKicker`, { team: t(`${teamKey(team.id)}.name`) })}
      title={{ before: t(`${COMMON}.faqTitleBefore`), accent: t(`${COMMON}.faqTitleAccent`) }}
      help={{
        before: t(`${COMMON}.faqHelpBefore`),
        accent: t(`${COMMON}.faqHelpAccent`),
        after: t(`${COMMON}.faqHelpAfter`),
      }}
      action={
        <SiteButton to="contact" variant="ghost">
          {t(`${COMMON}.faqCta`)}
        </SiteButton>
      }
      items={teamFaqItems(team, t)}
    />
  );
}
