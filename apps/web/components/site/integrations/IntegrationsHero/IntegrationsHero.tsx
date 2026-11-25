'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import PageHero from '../../PageHero';
import SiteButton from '../../SiteButton';
import { INTEGRATIONS_CRUMBS, toolsCount } from '../../product/productData';
import HubCollage from './HubCollage';

const H = 'site.integrations.hero';

export default function IntegrationsHero() {
  const { t, language } = useSiteTranslation();
  return (
    <PageHero
      crumbs={INTEGRATIONS_CRUMBS}
      title={{
        before: t(`${H}.titleBefore`),
        accent: t(`${H}.titleAccent`, { tools: toolsCount(language) }),
      }}
      lead={t(`${H}.lead`)}
      actions={
        <>
          <SiteButton anchor="#directorio" size="lg">
            {t(`${H}.primary`)}
          </SiteButton>
          <SiteButton to="contact" variant="ghost" size="lg">
            {t(`${H}.secondary`)}
          </SiteButton>
        </>
      }
      aside={<HubCollage />}
    />
  );
}
