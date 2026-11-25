'use client';

import { Check, Clock } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../Container';
import LogoTile, { BRAND_LOGOS } from '../LogoTile';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteLink from '../SiteLink';
import { useRovingTabs } from '../solutions/useRovingTabs';
import { E, PLATFORMS, PLATFORMS_ID } from './ecommerceData';
import styles from './PlatformTabs.module.css';

interface PlatformTabsProps {
  active: number;
  onChange: (i: number) => void;
}

const STEPS = [1, 2, 3, 4] as const;
const HAND = [1, 2, 3] as const;

/**
 * "Elige tu plataforma" (design/web: `.plat`, `platPanel`). Las 7 pestañas a la vista
 * (el diseño escondía 4 tras un botón) y las 7 vistas en el HTML del servidor, todas
 * menos la activa con `hidden`. Teclado como en el índice de Soluciones.
 */
export default function PlatformTabs({ active, onChange }: PlatformTabsProps) {
  const { t } = useSiteTranslation();
  const { select, listRef, tabRef, onKeyDown } = useRovingTabs(PLATFORMS.length, { active, onChange });
  const k = `${E}.platforms`;

  return (
    <Section surface="alt" id={PLATFORMS_ID} className={styles.section}>
      <Container>
        <SectionHead title={t(`${k}.title`)} lead={t(`${k}.lead`)} />
        <div
          ref={listRef}
          className={styles.tabs}
          role="tablist"
          aria-label={t(`${k}.tabsLabel`)}
          onKeyDown={onKeyDown}
        >
          {PLATFORMS.map((p, i) => (
            <button
              key={p.id}
              ref={tabRef(i)}
              type="button"
              role="tab"
              id={`plat-tab-${p.id}`}
              aria-selected={i === active}
              aria-controls={`plat-panel-${p.id}`}
              tabIndex={i === active ? 0 : -1}
              className={styles.tab}
              onClick={() => select(i)}
            >
              {/* El logo es la marca completa: su `alt` es el nombre accesible de la pestaña */}
              <LogoTile logo={BRAND_LOGOS[p.name]!} size="sm" className={styles.logo} />
            </button>
          ))}
        </div>

        {PLATFORMS.map((p, i) => {
          const base = `${k}.items.${p.id}`;
          return (
            <div
              key={p.id}
              role="tabpanel"
              id={`plat-panel-${p.id}`}
              aria-labelledby={`plat-tab-${p.id}`}
              hidden={i !== active}
              className={styles.panel}
            >
              <div className={styles.flow}>
                <div className={styles.col}>
                  <p className={styles.head}>
                    <b>01</b>
                    <span>{t(`${k}.customer`)}</span>
                  </p>
                  <ul className={styles.quotes}>
                    {STEPS.map((n) => (
                      <li key={n} className={p.who[n - 1] === 'a' ? styles.fromAgent : undefined}>
                        <small>{t(`${base}.s.s${n}.label`)}</small>
                        {t(`${base}.s.s${n}.quote`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <span className={styles.link} aria-hidden="true" />
                <div className={styles.col}>
                  <p className={styles.head}>
                    <b>02</b>
                    <span>{t(`${k}.agent`)}</span>
                  </p>
                  <div className={styles.card}>
                    <LogoTile logo={BRAND_LOGOS[p.name]!} size="sm" className={styles.cardLogo} />
                    <ol className={styles.rows}>
                      {STEPS.map((n) => (
                        <li key={n}>
                          <b className={styles.n} aria-hidden="true">
                            0{n}
                          </b>
                          <span>{t(`${base}.s.s${n}.does`)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
                <span className={styles.link} aria-hidden="true" />
                <div className={styles.col}>
                  <p className={styles.head}>
                    <b>03</b>
                    <span>{t(`${k}.result`)}</span>
                  </p>
                  <div className={`${styles.box} ${styles.ok}`}>
                    <p className={styles.boxK}>
                      <Check aria-hidden="true" />
                      {t(`${k}.touches`)}
                    </p>
                    <ul className={styles.chips}>
                      {Array.from({ length: p.touches }, (_, c) => (
                        <li key={c}>{t(`${base}.touch.c${c + 1}`)}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={`${styles.box} ${styles.hand}`}>
                    <p className={styles.boxK}>
                      <Clock aria-hidden="true" />
                      {t(`${k}.handoff`)}
                    </p>
                    <ul className={styles.bullets}>
                      {HAND.map((n) => (
                        <li key={n}>{t(`${k}.hand.${p.kind}.h${n}`)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <p className={styles.apiNote}>{t(`${k}.apiNote`)}</p>
            </div>
          );
        })}

        <p className={styles.missing}>
          {t(`${k}.missing`)}{' '}
          <SiteLink to="integrations" className={styles.textLink}>
            {t(`${k}.missingLink`)} <span aria-hidden="true">→</span>
          </SiteLink>
        </p>
      </Container>
    </Section>
  );
}
