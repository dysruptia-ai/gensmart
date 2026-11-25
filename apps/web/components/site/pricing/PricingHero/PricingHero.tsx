'use client';

import { PRICING } from '@gensmart/shared';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Breadcrumbs from '../../Breadcrumbs';
import Container from '../../Container';
import GlowBackdrop from '../../GlowBackdrop';
import { SITE_TRIAL_DAYS } from '../../siteTrial';
import { PRICING_CRUMBS } from '../pricingData';
import styles from './PricingHero.module.css';

const P = 'site.pricing';

export default function PricingHero() {
  const { t } = useSiteTranslation();
  return (
    <section className={styles.hero}>
      <GlowBackdrop />
      <Container className={styles.inner}>
        <Breadcrumbs crumbs={PRICING_CRUMBS} />
        <h1 className={styles.title}>
          {t(`${P}.titleBefore`)} <span className={styles.accent}>{t(`${P}.titleAccent`)}</span>
        </h1>
        <p className={styles.lead}>
          {t(`${P}.leadBefore`, { price: PRICING.solo.monthly })}{' '}
          <span className={styles.accent}>{t(`${P}.leadAccent`, { days: SITE_TRIAL_DAYS })}</span>
        </p>
      </Container>
    </section>
  );
}
