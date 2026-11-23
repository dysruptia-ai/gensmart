'use client';

import { useTranslation } from '@/hooks/useTranslation';
import FaqSection from '../../FaqSection';
import SiteButton from '../../SiteButton';
import { faqItems } from '../pricingData';

const F = 'site.pricing.faq';

/** Mismo texto que el JSON-LD `FAQPage` de la página (`faqItems`). */
export default function PricingFaq() {
  const { t, language } = useTranslation();
  return (
    <FaqSection
      headingId="faq-heading"
      kicker={t(`${F}.kicker`)}
      title={{ before: t(`${F}.titleBefore`), accent: t(`${F}.titleAccent`) }}
      help={{ before: t(`${F}.helpBefore`), accent: t(`${F}.helpAccent`), after: t(`${F}.helpAfter`) }}
      action={
        <SiteButton to="contact" variant="ghost">
          {t(`${F}.cta`)}
        </SiteButton>
      }
      items={faqItems(t, language)}
    />
  );
}
