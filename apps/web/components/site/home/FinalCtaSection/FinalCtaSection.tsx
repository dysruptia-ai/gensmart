'use client';

import { useTranslation } from '@/hooks/useTranslation';
import GlowBackdrop from '../../GlowBackdrop';
import SiteButton from '../../SiteButton';
import styles from './FinalCtaSection.module.css';

const P = 'site.home.cta';

export default function FinalCtaSection() {
  const { t } = useTranslation();
  return (
    <section className={styles.cta}>
      <GlowBackdrop variant="cta" />
      <div className={styles.content}>
        <h2 className={styles.title}>
          {t(`${P}.titleBefore`)} <span className={styles.accent}>{t(`${P}.titleAccent`)}</span>
        </h2>
        <p className={styles.lead}>{t(`${P}.lead`)}</p>
        <div className={styles.actions}>
          <SiteButton to="register" size="lg" className={styles.action}>
            {t(`${P}.primary`)}
          </SiteButton>
          <SiteButton to="contact" variant="ghost" size="lg" className={styles.action}>
            {t(`${P}.demo`)}
          </SiteButton>
        </div>
      </div>
    </section>
  );
}
