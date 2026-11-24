'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import SiteButton from '../SiteButton';
import { INDUSTRIES } from '../industries/industriesData';
import SolutionHeroChat from './SolutionHeroChat';
import { range } from './solutionsData';
import styles from './IndustryTabs.module.css';

// Mismo orden que las tarjetas y el diseño (`INDUSTRIES`): sin las horas a la vista, el de `CLOCK` no aporta.
const LIST = INDUSTRIES;

/**
 * "Elige tu tipo de negocio y mira una conversación" (design/web: `dayClock`).
 * Pestañas reales: las 12 vistas salen del servidor y todas menos la activa van con
 * `hidden`. Flechas, Inicio y Fin mueven el foco y activan la pestaña; solo la
 * activa está en el orden de tabulación.
 */
export default function IndustryTabs() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (i: number, focus: boolean) => {
    setActive(i);
    const tab = tabRefs.current[i];
    const list = listRef.current;
    if (!tab || !list) return;
    if (focus) tab.focus({ preventScroll: true });
    // En móvil la fila se desplaza sola dentro de su contenedor (nunca la página)
    if (list.scrollWidth > list.clientWidth) {
      const left = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
      list.scrollTo({ left, behavior: 'smooth' });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = LIST.length - 1;
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = active === last ? 0 : active + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = active === 0 ? last : active - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    select(next, true);
  };

  return (
    <div className={styles.clk}>
      <div
        ref={listRef}
        className={styles.tabs}
        role="tablist"
        aria-label={t('site.solutions.clockTabs')}
        onKeyDown={onKeyDown}
      >
        {LIST.map((industry, i) => (
          <button
            key={industry.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`clk-tab-${industry.slug}`}
            aria-selected={i === active}
            aria-controls={`clk-panel-${industry.slug}`}
            tabIndex={i === active ? 0 : -1}
            className={styles.tab}
            onClick={() => select(i, false)}
          >
            {t(`${industry.base}.name`)}
          </button>
        ))}
      </div>
      {LIST.map((industry, i) => (
        <div
          key={industry.id}
          role="tabpanel"
          id={`clk-panel-${industry.slug}`}
          aria-labelledby={`clk-tab-${industry.slug}`}
          hidden={i !== active}
          className={styles.panel}
        >
          <div className={styles.chat}>
            <SolutionHeroChat page={industry} />
          </div>
          <div className={styles.info}>
            <p className={styles.eyebrow}>{t(`${industry.base}.name`)}</p>
            <h3 className={styles.h3}>{t(`${industry.base}.short`)}</h3>
            <ol className={styles.flow}>
              {range(industry.flow).map((n) => (
                <li key={n}>{t(`${industry.base}.flow.f${n}`)}</li>
              ))}
            </ol>
            <SiteButton to={industry.id}>{t('site.solutions.clockCta')}</SiteButton>
          </div>
        </div>
      ))}
    </div>
  );
}
