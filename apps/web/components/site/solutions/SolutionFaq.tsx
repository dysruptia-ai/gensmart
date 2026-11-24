'use client';

import { useTranslation } from '@/hooks/useTranslation';
import FaqSection from '../FaqSection';
import SiteButton from '../SiteButton';
import { solutionFaqItems, type SolutionData } from './solutionsData';

interface SolutionFaqProps {
  page: SolutionData;
}

/** Mismo texto que el JSON-LD `FAQPage` de la página (`solutionFaqItems`). */
export default function SolutionFaq({ page }: SolutionFaqProps) {
  const { t } = useTranslation();
  const c = page.common;
  return (
    <FaqSection
      headingId="faq-heading"
      kicker={t(`${c}.faqKicker`, { name: t(`${page.base}.name`) })}
      title={{ before: t(`${c}.faqTitleBefore`), accent: t(`${c}.faqTitleAccent`) }}
      help={{
        before: t(`${c}.faqHelpBefore`),
        accent: t(`${c}.faqHelpAccent`),
        after: t(`${c}.faqHelpAfter`),
      }}
      action={
        <SiteButton to="contact" variant="ghost">
          {t(`${c}.faqCta`)}
        </SiteButton>
      }
      items={solutionFaqItems(page, t)}
    />
  );
}
