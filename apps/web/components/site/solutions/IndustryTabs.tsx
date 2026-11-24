'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SiteButton from '../SiteButton';
import { INDUSTRIES } from '../industries/industriesData';
import SolutionHeroChat from './SolutionHeroChat';
import { range } from './solutionsData';
import { useRovingTabs } from './useRovingTabs';
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
  const { active, select, listRef, tabRef, onKeyDown } = useRovingTabs(LIST.length);

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
            ref={tabRef(i)}
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
