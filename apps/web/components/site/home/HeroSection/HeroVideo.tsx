'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useReducedMotion } from '../../useReducedMotion';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './HeroVideo.module.css';

const HD_QUERY = '(min-width: 760px)';

function VideoPlayer({ lang, resolved }: { lang: SupportedLanguage; resolved: boolean }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const reduced = useReducedMotion();

  // Se asigna el src en el cliente (sin desajuste de hidratación): 1080p en pantallas anchas, 720p si no.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolved) return;
    const hd = window.matchMedia(HD_QUERY).matches;
    video.muted = true;
    video.src = `/video/gensmart-hero-motion-${lang}${hd ? '-1080' : ''}.mp4`;
    video.load();
  }, [lang, resolved]);

  const enableSound = () => {
    const video = videoRef.current;
    if (!video) return;
    if (soundOn) {
      video.muted = true;
      video.controls = false;
      setSoundOn(false);
      return;
    }
    video.muted = false;
    video.controls = true;
    setSoundOn(true);
    video.play().catch(() => {
      /* el navegador puede bloquear la reproducción; el usuario puede usar los controles */
    });
  };

  return (
    <div className={styles.frame}>
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay={!reduced}
        controls={reduced || soundOn}
        muted
        playsInline
        preload="metadata"
        poster={`/site/img/hero-motion-poster-${lang}.webp`}
        aria-label={t('site.home.hero.videoLabel')}
      >
        {resolved ? (
          <track
            kind="captions"
            srcLang={lang}
            label={t('site.home.hero.trackLabel')}
            src={`/video/gensmart-hero-motion-${lang}.vtt`}
            default
          />
        ) : null}
      </video>
      <button type="button" className={styles.sound} aria-pressed={soundOn} onClick={enableSound}>
        {soundOn ? (
          <Volume2 size="1.35em" aria-hidden="true" />
        ) : (
          <VolumeX size="1.35em" aria-hidden="true" />
        )}
        <span>{soundOn ? t('site.home.hero.soundOff') : t('site.home.hero.soundOn')}</span>
      </button>
    </div>
  );
}

export default function HeroVideo() {
  const { language, isLanguageResolved } = useLanguage();
  return (
    <div className={styles.wrap}>
      <VideoPlayer key={language} lang={language} resolved={isLanguageResolved} />
    </div>
  );
}
