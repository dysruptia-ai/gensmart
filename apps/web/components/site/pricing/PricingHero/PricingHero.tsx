'use client';

import { PRICING } from '@gensmart/shared';
import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import GlowBackdrop from '../../GlowBackdrop';
import SiteLink from '../../SiteLink';
import { SITE_TRIAL_DAYS } from '../../siteTrial';
import styles from './PricingHero.module.css';

const P = 'site.pricing';

export default function PricingHero() {
  const { t } = useTranslation();
  return (
    <section className={styles.hero}>
      <GlowBackdrop />
      <Container className={styles.inner}>
        <nav aria-label={t(`${P}.crumbsLabel`)}>
          <ol className={styles.crumbs}>
            <li>
              <SiteLink to="home">{t(`${P}.crumbHome`)}</SiteLink>
            </li>
            <li aria-current="page">{t(`${P}.crumbCurrent`)}</li>
          </ol>
        </nav>
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
