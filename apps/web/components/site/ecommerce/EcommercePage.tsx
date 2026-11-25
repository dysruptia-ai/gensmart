'use client';

import { useState } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import FaqSection from '../FaqSection';
import PageHero from '../PageHero';
import SiteButton from '../SiteButton';
import AbandonSection from './AbandonSection';
import EcommerceCalculator from './EcommerceCalculator';
import EcommercePlans from './EcommercePlans';
import PlatformTabs from './PlatformTabs';
import RoleSplit from './RoleSplit';
import StartSteps from './StartSteps';
import StoreCases from './StoreCases';
import { CALC_ID, E, ECOMMERCE_CRUMBS, ecommerceFaqItems } from './ecommerceData';

/**
 * Landing E-commerce: "agente comercial para tu tienda online" (design/web: `ecommerce`).
 * Se diferencia de la industria E-commerce y dropshipping (atención por chat) y se enlazan entre sí.
 */
export default function EcommercePage() {
  const { t } = useSiteTranslation();
  // Pestaña de plataforma activa: la comparten las pestañas y las tarjetas de "Ubica tu tienda"
  const [platform, setPlatform] = useState(0);
  const f = `${E}.faq`;

  return (
    <>
      <PageHero
        crumbs={ECOMMERCE_CRUMBS}
        title={{ before: t(`${E}.hero.titleBefore`), accent: t(`${E}.hero.titleAccent`) }}
        lead={t(`${E}.hero.lead`)}
        photo={{ src: '/site/img/ecommerce/ecom-tienda.webp', position: '50% 30%', light: false }}
        actions={
          <>
            <SiteButton to="register">{t(`${E}.hero.primary`)}</SiteButton>
            <SiteButton anchor={`#${CALC_ID}`} variant="ghost">
              {t(`${E}.hero.calc`)}
            </SiteButton>
          </>
        }
      />
      <AbandonSection />
      <PlatformTabs active={platform} onChange={setPlatform} />
      <RoleSplit />
      <StoreCases onPickPlatform={setPlatform} />
      <StartSteps />
      <EcommercePlans />
      <EcommerceCalculator />
      <FaqSection
        headingId="faq-heading"
        kicker={t(`${f}.kicker`)}
        title={{ before: t(`${f}.titleBefore`), accent: t(`${f}.titleAccent`) }}
        help={{ before: t(`${f}.helpBefore`), accent: t(`${f}.helpAccent`), after: t(`${f}.helpAfter`) }}
        action={
          <SiteButton to="contact" variant="ghost">
            {t(`${f}.cta`)}
          </SiteButton>
        }
        items={ecommerceFaqItems(t)}
      />
    </>
  );
}
