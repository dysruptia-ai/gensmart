'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Play } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import styles from './DocVideo.module.css';

interface PlayState {
  start: number;
  /** Cambia en cada clic: recarga el iframe aunque el segundo sea el mismo. */
  nonce: number;
}

interface VideoContextValue {
  playing: Record<string, PlayState>;
  play: (videoId: string, start: number) => void;
  register: (videoId: string, el: HTMLElement | null) => void;
}

const VideoContext = createContext<VideoContextValue | null>(null);

/** Comparte el estado entre el video y sus capítulos (bloques separados de la guía). */
export function DocVideoProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState<Record<string, PlayState>>({});
  const frames = useRef(new Map<string, HTMLElement>());

  const play = useCallback((videoId: string, start: number) => {
    setPlaying((prev) => ({ ...prev, [videoId]: { start, nonce: (prev[videoId]?.nonce ?? 0) + 1 } }));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    frames.current.get(videoId)?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const register = useCallback((videoId: string, el: HTMLElement | null) => {
    if (el) frames.current.set(videoId, el);
    else frames.current.delete(videoId);
  }, []);

  const value = useMemo(() => ({ playing, play, register }), [playing, play, register]);
  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}

function useVideo(): VideoContextValue {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('DocVideo fuera de DocVideoProvider');
  return ctx;
}

interface DocVideoProps {
  videoId: string;
  title: string;
  caption: string;
}

/**
 * Fachada liviana: miniatura y botón. El iframe de youtube-nocookie solo se carga al hacer clic
 * (o al elegir un capítulo), con `start` en el segundo pedido.
 */
export function DocVideo({ videoId, title, caption }: DocVideoProps) {
  const { t } = useSiteTranslation();
  const { playing, play, register } = useVideo();
  const state = playing[videoId];
  const src = state
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&start=${state.start}`
    : null;

  return (
    <figure className={styles.video} ref={(el) => register(videoId, el)}>
      <div className={styles.frame}>
        {src ? (
          <iframe
            key={state?.nonce}
            src={src}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube, sin optimizar */}
            <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" width={480} height={360} loading="lazy" />
            <button
              type="button"
              className={styles.play}
              aria-label={t('site.docs.video.play', { title })}
              onClick={() => play(videoId, 0)}
            >
              <Play size={28} fill="currentColor" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

interface DocChaptersProps {
  videoId: string;
  items: { start: number; title: string }[];
}

/** Capítulos: cada uno carga el video (o lo mueve) a su segundo. */
export function DocChapters({ videoId, items }: DocChaptersProps) {
  const { t } = useSiteTranslation();
  const { play } = useVideo();
  return (
    <ol className={styles.chapters} aria-label={t('site.docs.video.chapters')}>
      {items.map((item) => (
        <li key={item.start}>
          <button type="button" onClick={() => play(videoId, item.start)}>
            <time dateTime={`PT${item.start}S`}>{clock(item.start)}</time>
            <span>{item.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
