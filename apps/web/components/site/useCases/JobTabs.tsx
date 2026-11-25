'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import ChatBubble from '../ChatBubble';
import SiteLink from '../SiteLink';
import { useRovingTabs } from '../solutions/useRovingTabs';
import { JOBS, U } from './useCasesData';
import styles from './JobTabs.module.css';

/**
 * Los 6 trabajos (design/web: `.cu`). Pestañas reales en vertical: las 6 vistas salen
 * del servidor y todas menos la activa van con `hidden`. Flechas (las 4), Inicio y Fin
 * mueven el foco y activan la pestaña; solo la activa está en el orden de tabulación.
 * En móvil la lista pasa arriba y se desplaza dentro de sí misma, nunca la página.
 */
export default function JobTabs() {
  const { t } = useSiteTranslation();
  const { active, select, listRef, tabRef, onKeyDown } = useRovingTabs(JOBS.length);

  return (
    <div className={styles.cu}>
      <div
        ref={listRef}
        className={styles.list}
        role="tablist"
        aria-orientation="vertical"
        aria-label={t(`${U}.jobsLabel`)}
        onKeyDown={onKeyDown}
      >
        {JOBS.map((job, i) => (
          <button
            key={job.id}
            ref={tabRef(i)}
            type="button"
            role="tab"
            id={`cu-tab-${job.id}`}
            aria-selected={i === active}
            aria-controls={`cu-panel-${job.id}`}
            tabIndex={i === active ? 0 : -1}
            className={styles.tab}
            onClick={() => select(i, false)}
          >
            <span className={styles.q}>{t(`${U}.jobs.${job.id}.k`)}</span>
            <span className={styles.k}>{t(`${U}.jobs.${job.id}.s`)}</span>
          </button>
        ))}
      </div>
      <div className={styles.stage}>
        {JOBS.map((job, i) => {
          const k = `${U}.jobs.${job.id}`;
          return (
            <div
              key={job.id}
              role="tabpanel"
              id={`cu-panel-${job.id}`}
              aria-labelledby={`cu-tab-${job.id}`}
              hidden={i !== active}
              className={styles.panel}
            >
              <div>
                <h2 className={styles.h}>{t(`${k}.h`)}</h2>
                <p className={styles.lead}>{t(`${k}.p`)}</p>
              </div>
              <p className={styles.leg} aria-hidden="true">
                <span className={styles.legMsg}>{t(`${U}.legendMsg`)}</span>
                <span className={styles.legAct}>{t(`${U}.legendAct`)}</span>
              </p>
              {/* Maqueta: nada enfocable; los prefijos ocultos dicen quién habla o qué hace el agente */}
              <div role="group" aria-label={t(`${U}.timelineLabel`, { job: t(`${k}.k`) })}>
                <ol className={styles.tl}>
                  {job.steps.map((type, n) => {
                    const text = t(`${k}.steps.s${n + 1}`);
                    if (type === 'act') {
                      return (
                        <li key={n} className={styles.act}>
                          <span className={styles.sr}>{t(`${U}.actionPrefix`)} </span>
                          {text}
                        </li>
                      );
                    }
                    return (
                      <li key={n} className={styles.msg}>
                        <ChatBubble direction={type} className={styles.bubble}>
                          <span className={styles.sr}>{t(type === 'in' ? `${U}.customer` : `${U}.agent`)} </span>
                          {text}
                        </ChatBubble>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className={styles.res}>
                <h3 className={styles.resTitle}>{t(`${U}.resTitle`)}</h3>
                <p>{t(`${k}.res`)}</p>
                <SiteLink to={job.link} className={styles.more}>
                  {t(`${k}.link`)} <span aria-hidden="true">→</span>
                </SiteLink>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
