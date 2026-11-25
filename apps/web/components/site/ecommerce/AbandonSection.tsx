'use client';

import { Check } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../Container';
import Reveal from '../Reveal';
import Section from '../Section';
import SectionHead from '../SectionHead';
import { ABANDON_RATE, ABANDON_REASONS, BAYMARD_URL, E, formatPercent } from './ecommerceData';
import styles from './AbandonSection.module.css';

const MAX = Math.max(...ABANDON_REASONS);

/** "Siete de cada diez carritos se quedan sin pagar" (design/web: `.ab-wrap`). */
export default function AbandonSection() {
  const { t, language } = useSiteTranslation();
  const k = `${E}.abandon`;
  return (
    <Section surface="dark">
      <Container>
        <SectionHead title={t(`${k}.title`)} lead={t(`${k}.lead`)} />
        <div className={styles.wrap}>
          <div className={styles.stat}>
            <p className={styles.fig}>{formatPercent(language, ABANDON_RATE * 100, 2)}</p>
            <p className={styles.soft}>{t(`${k}.figNote`)}</p>
            <p className={styles.note}>
              {t(`${k}.source`)}{' '}
              <a className={styles.link} href={BAYMARD_URL} target="_blank" rel="noopener">
                Baymard Institute
              </a>
              {t(`${k}.sourceAfter`)}
            </p>
          </div>
          <ol className={styles.list} aria-label={t(`${k}.listLabel`)}>
            {ABANDON_REASONS.map((value, i) => (
              <li key={i}>
                <Reveal>
                  <div className={styles.top}>
                    <span className={styles.label}>{t(`${k}.reasons.r${i + 1}.label`)}</span>
                    <b>{formatPercent(language, value)}</b>
                  </div>
                  <div className={styles.bar} aria-hidden="true">
                    {/* Ancho dinámico: único estilo en línea, proporcional al motivo mayor */}
                    <i style={{ width: `${Math.round((value / MAX) * 100)}%` }} />
                  </div>
                  <p className={styles.help}>
                    <Check aria-hidden="true" />
                    {t(`${k}.reasons.r${i + 1}.help`)}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
