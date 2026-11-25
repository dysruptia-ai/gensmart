'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import PageHero from '../../PageHero';
import SiteButton from '../../SiteButton';
import { PRODUCT_CRUMBS, productValues } from '../productData';
import LayerStack from './LayerStack';

const H = 'site.product.hero';

export default function ProductHero() {
  const { t, language } = useSiteTranslation();
  const values = productValues(t, language);
  return (
    <PageHero
      size="feature"
      crumbs={PRODUCT_CRUMBS}
      title={{
        before: t(`${H}.titleBefore`),
        accent: t(`${H}.titleAccent`),
        after: t(`${H}.titleAfter`),
      }}
      lead={t(`${H}.lead`)}
      actions={
        <>
          <SiteButton to="register" size="lg">
            {t(`${H}.primary`)}
          </SiteButton>
          <SiteButton to="contact" variant="ghost" size="lg">
            {t(`${H}.demo`)}
          </SiteButton>
        </>
      }
      note={t(`${H}.note`, values)}
      aside={<LayerStack />}
    />
  );
}
