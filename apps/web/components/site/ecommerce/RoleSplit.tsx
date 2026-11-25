'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../Container';
import Reveal from '../Reveal';
import Section from '../Section';
import SectionHead from '../SectionHead';
import { E } from './ecommerceData';
import styles from './RoleSplit.module.css';

const ITEMS = [1, 2, 3, 4] as const;

/** "Lo que el agente hace solo y lo que decide tu equipo" (design/web: `.role2`). */
export default function RoleSplit() {
  const { t } = useSiteTranslation();
  const k = `${E}.split`;
  return (
    <Section surface="dark">
      <Container>
        <SectionHead title={t(`${k}.title`)} lead={t(`${k}.lead`)} />
        <Reveal className={styles.split}>
          <div className={`${styles.col} ${styles.ok}`}>
            <p className={styles.kicker}>{t(`${k}.agentKicker`)}</p>
            <h3 className={styles.h3}>{t(`${k}.agentTitle`)}</h3>
            <ol className={styles.list}>
              {ITEMS.map((n) => (
                <li key={n}>{t(`${k}.agent.i${n}`)}</li>
              ))}
            </ol>
          </div>
          <div className={styles.mid} aria-hidden="true">
            <span>{t(`${k}.mid`)}</span>
          </div>
          <div className={styles.col}>
            <p className={styles.kicker}>{t(`${k}.teamKicker`)}</p>
            <h3 className={styles.h3}>{t(`${k}.teamTitle`)}</h3>
            <ol className={styles.list}>
              {ITEMS.map((n) => (
                <li key={n}>{t(`${k}.team.i${n}`)}</li>
              ))}
            </ol>
          </div>
        </Reveal>
        <p className={styles.foot}>{t(`${k}.foot`)}</p>
      </Container>
    </Section>
  );
}
