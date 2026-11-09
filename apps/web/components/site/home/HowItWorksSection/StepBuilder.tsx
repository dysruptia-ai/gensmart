'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import ChatBubble from '../../ChatBubble';
import { useReducedMotion } from '../../useReducedMotion';
import styles from './StepBuilder.module.css';

const STEPS = [1, 2, 3] as const;
type Step = (typeof STEPS)[number];

const AUTO_ADVANCE_MS = 4300;

type ChannelId = 'whatsapp' | 'instagram' | 'messenger' | 'telegram' | 'email' | 'website';
const CHANNELS: Array<{ id: ChannelId; labelKey: string }> = [
  { id: 'whatsapp', labelKey: 'chWhatsapp' },
  { id: 'instagram', labelKey: 'chInstagram' },
  { id: 'messenger', labelKey: 'chMessenger' },
  { id: 'telegram', labelKey: 'chTelegram' },
  { id: 'email', labelKey: 'chEmail' },
  { id: 'website', labelKey: 'chWebsite' },
];

const INITIAL_CHANNELS: Record<ChannelId, boolean> = {
  whatsapp: true,
  instagram: true,
  messenger: false,
  telegram: false,
  email: false,
  website: true,
};

export default function StepBuilder() {
  const { t } = useTranslation();
  const uid = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [active, setActive] = useState<Step>(1);
  const [started, setStarted] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [channels, setChannels] = useState(INITIAL_CHANNELS);

  const auto = started && !stopped && !reduced;

  // Arranca el avance automático al entrar en pantalla (una sola vez)
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Avanza 1 → 2 → 3 → 1… cada 4300 ms; se reinicia en cada cambio de paso
  useEffect(() => {
    if (!auto) return;
    const timer = window.setTimeout(() => {
      setActive((s) => (s === 3 ? 1 : ((s + 1) as Step)));
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [auto, active]);

  const select = (step: Step) => {
    setStopped(true);
    setActive(step);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = tabRefs.current.findIndex((el) => el === document.activeElement);
    if (idx < 0) return;
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % STEPS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + STEPS.length) % STEPS.length;
    else return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
  };

  const p = 'site.home.how';

  return (
    <div ref={rootRef} className={styles.builder}>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={t(`${p}.tablist`)}
        onKeyDown={onKeyDown}
      >
        {STEPS.map((step, i) => {
          const selected = active === step;
          return (
            <button
              key={step}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${step}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${step}`}
              tabIndex={selected ? 0 : -1}
              className={[styles.tab, selected ? styles.tabActive : ''].filter(Boolean).join(' ')}
              onClick={() => select(step)}
            >
              <b className={styles.tabTitle}>{t(`${p}.step${step}Title`)}</b>
              <span className={styles.tabDesc}>{t(`${p}.step${step}Desc`)}</span>
              {selected && auto ? <span key={active} className={styles.progress} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      <div className={styles.app} aria-label={t(`${p}.appLabel`)} role="group">
        <div className={styles.appBar}>
          <i className={styles.dot} />
          <i className={styles.dot} />
          <i className={styles.dot} />
          <em className={styles.appTitle}>{t(`${p}.appTitle`)}</em>
        </div>
        <div className={styles.body}>
          {/* Panel 1 */}
          <div
            role="tabpanel"
            id={`${uid}-panel-1`}
            aria-labelledby={`${uid}-tab-1`}
            hidden={active !== 1}
            className={styles.panel}
          >
            <h3 className={styles.h4}>{t(`${p}.p1Title`)}</h3>
            <div className={styles.chanGrid}>
              {CHANNELS.map((c) => {
                const on = channels[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    className={[styles.chan, styles[c.id], on ? styles.chanOn : ''].filter(Boolean).join(' ')}
                    onClick={() => setChannels((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                  >
                    <span className={styles.chanDot} />
                    <span className={styles.chanLabel}>{t(`${p}.${c.labelKey}`)}</span>
                    <span className={styles.tick}>
                      {on ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className={styles.note}>{t(`${p}.p1Note`)}</p>
          </div>

          {/* Panel 2 */}
          <div
            role="tabpanel"
            id={`${uid}-panel-2`}
            aria-labelledby={`${uid}-tab-2`}
            hidden={active !== 2}
            className={styles.panel}
          >
            <h3 className={styles.h4}>{t(`${p}.p2Title`)}</h3>
            <div className={styles.kv}>
              <div>
                <span>{t(`${p}.kvName`)}</span>
                <b>{t(`${p}.kvNameValue`)}</b>
              </div>
              <div>
                <span>{t(`${p}.kvGoal`)}</span>
                <b>{t(`${p}.kvGoalValue`)}</b>
              </div>
              {(
                [
                  ['kvFile1', 'kvRead'],
                  ['kvFile2', 'kvRead'],
                  ['kvSite', 'kvSynced'],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <span>{t(`${p}.${label}`)}</span>
                  <b>
                    <Check size="1em" strokeWidth={3} aria-hidden="true" className={styles.kvCheck} />
                    {t(`${p}.${value}`)}
                  </b>
                </div>
              ))}
            </div>
            <div className={styles.bar} role="presentation">
              <i className={styles.barFill} />
            </div>
          </div>

          {/* Panel 3 */}
          <div
            role="tabpanel"
            id={`${uid}-panel-3`}
            aria-labelledby={`${uid}-tab-3`}
            hidden={active !== 3}
            className={styles.panel}
          >
            <div className={styles.switch}>
              <div>
                <b className={styles.switchTitle}>{t(`${p}.p3Active`)}</b>
                <div className={styles.live}>
                  <i className={styles.pulse} />
                  {t(`${p}.p3Live`)}
                </div>
              </div>
              <span className={styles.tog} role="img" aria-label={t(`${p}.p3Toggle`)} />
            </div>
            <div className={styles.msgs}>
              <ChatBubble direction="in">{t(`${p}.p3In`)}</ChatBubble>
              <ChatBubble direction="out">{t(`${p}.p3Out`)}</ChatBubble>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
