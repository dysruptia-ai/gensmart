'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import styles from './FiguresSection.module.css';

const P = 'site.home.figures';
const IDS = [1, 2, 3, 4] as const;

export default function FiguresSection() {
  const { t } = useTranslation();
  return (
    <Section surface="dark" className={styles.figures}>
      <Container>
        <SectionHead title={t(`${P}.title`)} />
        <div className={styles.grid}>
          {IDS.map((i) => (
            <div key={i}>
              <div className={styles.number}>{t(`${P}.n${i}`)}</div>
              <p className={styles.text}>{t(`${P}.t${i}`)}</p>
            </div>
          ))}
        </div>
        <p className={styles.source}>{t(`${P}.source`)}</p>
      </Container>
    </Section>
  );
}
