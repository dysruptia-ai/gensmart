'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import {
  CalendarDays,
  ChartLine,
  Filter,
  Globe,
  Inbox,
  Mail,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { AnthropicLogo, OpenAILogo, OpenRouterLogo } from './AiProviderLogos';
import styles from './ChannelMap.module.css';

type Side = 'in' | 'out';

interface MapItem {
  id: string;
  labelKey: string;
  logo?: string;
  icon?: LucideIcon;
  soon?: boolean;
}

const INPUTS: MapItem[] = [
  { id: 'whatsapp', labelKey: '', logo: '/site/img/logos/whatsapp.svg' },
  { id: 'instagram', labelKey: '', logo: '/site/img/logos/instagram.svg' },
  { id: 'messenger', labelKey: '', logo: '/site/img/logos/messenger.svg' },
  { id: 'telegram', labelKey: '', logo: '/site/img/logos/telegram.svg' },
  { id: 'email', labelKey: 'site.home.platform.map.email', icon: Mail },
  { id: 'website', labelKey: 'site.home.platform.map.website', icon: Globe },
  { id: 'tiktok', labelKey: 'site.home.platform.map.tiktok', icon: Sparkles, soon: true },
];

const BRAND_NAMES: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  telegram: 'Telegram',
};

const OUTPUTS: MapItem[] = [
  { id: 'inbox', labelKey: 'site.home.platform.map.inbox', icon: Inbox },
  { id: 'crm', labelKey: 'site.home.platform.map.crm', icon: Filter },
  { id: 'calendar', labelKey: 'site.home.platform.map.calendar', icon: CalendarDays },
  { id: 'metrics', labelKey: 'site.home.platform.map.metrics', icon: ChartLine },
];

const WIRES_MIN_WIDTH = 820;
const RESIZE_DEBOUNCE_MS = 90;
const DOT_STAGGER_S = 0.58;

interface Wire {
  d: string;
  side: Side;
}

interface Gradient {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface WireLayout {
  w: number;
  h: number;
  wires: Wire[];
  gradients: Record<Side, Gradient>;
}

function subscribeMedia(query: string, cb: () => void): () => void {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => subscribeMedia('(prefers-reduced-motion: reduce)', cb),
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );
}

function useOffsetPathSupport(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => typeof CSS !== 'undefined' && CSS.supports('offset-path', 'path("M0 0L1 1")'),
    () => false
  );
}

export default function ChannelMap() {
  const { t, language } = useTranslation();
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLSpanElement>(null);
  const [layout, setLayout] = useState<WireLayout | null>(null);
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();
  const canFlow = useOffsetPathSupport();

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const map = mapRef.current;
    const hubEl = hubRef.current;
    if (!wrap || !map || !hubEl) return;
    const box = map.getBoundingClientRect();
    const horizontal = wrap.getBoundingClientRect().width >= WIRES_MIN_WIDTH;
    const rel = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - box.left,
        right: r.right - box.left,
        top: r.top - box.top,
        bottom: r.bottom - box.top,
        cx: (r.left + r.right) / 2 - box.left,
        cy: (r.top + r.bottom) / 2 - box.top,
      };
    };
    const hub = rel(hubEl);
    const wires: Wire[] = [];
    map.querySelectorAll<HTMLElement>('[data-cnode]').forEach((el) => {
      const side = el.dataset['side'] as Side;
      const it = rel(el);
      let d: string;
      if (horizontal) {
        const [x1, y1, x2, y2] =
          side === 'in' ? [it.right, it.cy, hub.left, hub.cy] : [hub.right, hub.cy, it.left, it.cy];
        const dx = (x2 - x1) * 0.55;
        d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      } else {
        const [x1, y1, x2, y2] =
          side === 'in' ? [it.cx, it.bottom, hub.cx, hub.top] : [hub.cx, hub.bottom, it.cx, it.top];
        const dy = (y2 - y1) * 0.55;
        d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
      }
      wires.push({ d, side });
    });
    const gradients: Record<Side, Gradient> = horizontal
      ? {
          in: { x1: 0, y1: 0, x2: hub.left, y2: 0 },
          out: { x1: hub.right, y1: 0, x2: box.width, y2: 0 },
        }
      : {
          in: { x1: 0, y1: 0, x2: 0, y2: hub.top },
          out: { x1: 0, y1: hub.bottom, x2: 0, y2: box.height },
        };
    setLayout({ w: box.width, h: box.height, wires, gradients });
  }, []);

  // Recalcula al cambiar el tamaño del mapa (con debounce)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let timer: number | undefined;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, RESIZE_DEBOUNCE_MS);
    });
    ro.observe(wrap);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, [measure]);

  // Recalcula cuando las fuentes cargan y al cambiar de idioma
  useEffect(() => {
    let cancelled = false;
    const raf = requestAnimationFrame(measure);
    document.fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [measure, language]);

  // Pausa los puntos cuando el mapa está fuera de pantalla
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true), {
      rootMargin: '120px',
    });
    io.observe(wrap);
    return () => io.disconnect();
  }, []);

  const renderItem = (item: MapItem, side: Side): ReactNode => {
    const label = item.labelKey ? t(item.labelKey) : (BRAND_NAMES[item.id] ?? item.id);
    const Icon = item.icon;
    return (
      <li
        key={item.id}
        data-cnode=""
        data-side={side}
        className={[styles.item, side === 'in' ? styles.itemIn : styles.itemOut, item.soon ? styles.soon : '']
          .filter(Boolean)
          .join(' ')}
      >
        {item.logo ? (
          <Image src={item.logo} alt="" width={18} height={18} unoptimized className={styles.brandLogo} />
        ) : Icon ? (
          <span className={styles.iconBox} aria-hidden="true">
            <Icon size={14} />
          </span>
        ) : null}
        <span>{label}</span>
      </li>
    );
  };

  const gradId = (side: Side) => `${uid}-${side}`;
  const showDots = canFlow && !reduced;

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div ref={mapRef} className={[styles.map, visible ? '' : styles.paused].filter(Boolean).join(' ')}>
        {layout ? (
          <svg
            className={styles.wires}
            viewBox={`0 0 ${layout.w} ${layout.h}`}
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              {(['in', 'out'] as const).map((side) => {
                const g = layout.gradients[side];
                const strongFirst = side === 'out';
                return (
                  <linearGradient
                    key={side}
                    id={gradId(side)}
                    gradientUnits="userSpaceOnUse"
                    x1={g.x1}
                    y1={g.y1}
                    x2={g.x2}
                    y2={g.y2}
                  >
                    <stop offset="0" className={strongFirst ? styles.stopStrong : styles.stopWeak} />
                    <stop offset="1" className={strongFirst ? styles.stopWeak : styles.stopStrong} />
                  </linearGradient>
                );
              })}
            </defs>
            {layout.wires.map((wire, i) => (
              <path key={i} d={wire.d} className={styles.wire} stroke={`url(#${gradId(wire.side)})`} />
            ))}
            {showDots
              ? layout.wires.map((wire, i) => (
                  <circle
                    key={`dot-${i}`}
                    r={2.6}
                    className={styles.dot}
                    style={{ offsetPath: `path("${wire.d}")`, animationDelay: `${-(i * DOT_STAGGER_S)}s` }}
                  />
                ))
              : null}
          </svg>
        ) : null}

        <div className={`${styles.side} ${styles.sideIn}`}>
          <span className={styles.sideTitle}>{t('site.home.platform.map.inTitle')}</span>
          <ul className={styles.list}>{INPUTS.map((i) => renderItem(i, 'in'))}</ul>
        </div>

        <div className={styles.core}>
          <span ref={hubRef} className={styles.node}>
            <Image
              src="/site/img/logo-gensmart-inv.svg"
              alt="GenSmart"
              width={170}
              height={47}
              unoptimized
              className={styles.hubLogo}
            />
            <span className={styles.hubText}>{t('site.home.platform.map.hub')}</span>
            <span className={styles.engine}>
              <b className={styles.srOnly}>{t('site.home.platform.map.runsOn')}</b>
              <span className={styles.brains}>
                <i title="Anthropic" className={styles.brain}>
                  <AnthropicLogo className={styles.brainSvg} />
                  <em className={styles.srOnly}>Anthropic</em>
                </i>
                <i title="OpenAI" className={styles.brain}>
                  <OpenAILogo className={styles.brainSvg} />
                  <em className={styles.srOnly}>OpenAI</em>
                </i>
                <i title="OpenRouter" className={styles.brain}>
                  <OpenRouterLogo className={styles.brainSvg} />
                  <em className={styles.srOnly}>OpenRouter</em>
                </i>
              </span>
            </span>
          </span>
        </div>

        <div className={`${styles.side} ${styles.sideOut}`}>
          <span className={`${styles.sideTitle} ${styles.sideTitleOut}`}>
            {t('site.home.platform.map.outTitle')}
          </span>
          <ul className={styles.list}>{OUTPUTS.map((i) => renderItem(i, 'out'))}</ul>
        </div>
      </div>
    </div>
  );
}
