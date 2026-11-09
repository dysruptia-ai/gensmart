'use client';

import Image from 'next/image';
import { Globe, Mail } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import GlowBackdrop from '../../GlowBackdrop';
import SiteButton from '../../SiteButton';
import HeroVideo from './HeroVideo';
import styles from './HeroSection.module.css';

interface Channel {
  name: string;
  logo: string;
}

const LOGO_CHANNELS: Channel[] = [
  { name: 'WhatsApp', logo: '/site/img/logos/whatsapp.svg' },
  { name: 'Instagram', logo: '/site/img/logos/instagram.svg' },
  { name: 'Messenger', logo: '/site/img/logos/messenger.svg' },
  { name: 'Telegram', logo: '/site/img/logos/telegram.svg' },
];

function ChannelLogo({ src }: { src: string }) {
  return (
    <Image src={src} alt="" width={19} height={19} unoptimized className={styles.channelLogo} />
  );
}

export default function HeroSection() {
  const { t } = useTranslation();
  return (
    <section className={styles.hero}>
      <GlowBackdrop variant="hero" />
      <div className={styles.content}>
        <h1 className={styles.title}>
          {t('site.home.hero.titleLine1')}
          <br />
          <span className={styles.accent}>{t('site.home.hero.titleAccent')}</span>
        </h1>
        <p className={styles.lead}>{t('site.home.hero.lead')}</p>
        <div className={styles.actions}>
          <SiteButton to="register" size="lg" className={styles.action}>
            {t('site.home.hero.cta')}
          </SiteButton>
          {/* El ancla #como la tendrá una sección posterior */}
          <a href="#como" className={`${styles.action} ${styles.ghost}`}>
            {t('site.home.hero.secondary')}
          </a>
        </div>

        <ul className={styles.channels} aria-label={t('site.home.hero.channelsLabel')}>
          {LOGO_CHANNELS.map((c) => (
            <li key={c.name} className={styles.channel}>
              <ChannelLogo src={c.logo} />
              {c.name}
            </li>
          ))}
          <li className={styles.channel}>
            <Mail size={21} aria-hidden="true" className={styles.channelIcon} />
            {t('site.home.hero.email')}
          </li>
          <li className={styles.channel}>
            <Globe size={21} aria-hidden="true" className={styles.channelIcon} />
            {t('site.home.hero.website')}
          </li>
          <li className={styles.channel}>
            <ChannelLogo src="/site/img/logos/tiktok-dark.svg" />
            TikTok
            <span className={styles.soon}>{t('site.home.hero.soon')}</span>
          </li>
        </ul>

        <HeroVideo />
      </div>
    </section>
  );
}
