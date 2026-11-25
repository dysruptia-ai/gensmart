'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import FaqSection from '../../FaqSection';
import SiteButton from '../../SiteButton';
import { productFaqItems } from '../productData';

const F = 'site.product.faq';

/** Mismo texto que el JSON-LD `FAQPage` de la página (`productFaqItems`). */
export default function ProductFaq() {
  const { t, language } = useSiteTranslation();
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
      items={productFaqItems(t, language)}
    />
  );
}
