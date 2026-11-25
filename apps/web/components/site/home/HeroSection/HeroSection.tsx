'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import ChannelsStrip from '../../ChannelsStrip';
import GlowBackdrop from '../../GlowBackdrop';
import SiteButton from '../../SiteButton';
import HeroVideo from './HeroVideo';
import styles from './HeroSection.module.css';


export default function HeroSection() {
  const { t } = useSiteTranslation();
  return (
    <section className={styles.hero}>
      <GlowBackdrop variant="hero" />
      <div className={styles.content}>
        <p className={styles.eyebrow}>{t('site.home.hero.eyebrow')}</p>
        <h1 className={styles.title}>
          {t('site.home.hero.titleBefore')}{' '}
          <span className={styles.accent}>{t('site.home.hero.titleAccent')}</span>{' '}
          {t('site.home.hero.titleAfter')}
        </h1>
        <p className={styles.lead}>{t('site.home.hero.lead')}</p>
        <div className={styles.actions}>
          <SiteButton to="register" size="lg" className={styles.action}>
            {t('site.home.hero.cta')}
          </SiteButton>
          <SiteButton anchor="#como" variant="ghost" size="lg" className={styles.action}>
            {t('site.home.hero.secondary')}
          </SiteButton>
        </div>

        <ChannelsStrip label={t('site.home.hero.channelsLabel')} className={styles.channels} />

        <HeroVideo />
      </div>
    </section>
  );
}
