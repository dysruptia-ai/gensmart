'use client';

import { FileText, Play, Plug, type LucideIcon } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../Container';
import Reveal from '../Reveal';
import Section from '../Section';
import SectionHead from '../SectionHead';
import { E } from './ecommerceData';
import styles from './StartSteps.module.css';

const ICONS: readonly LucideIcon[] = [Plug, FileText, Play];

/** "Tu agente de tienda online, en tres pasos" (design/web: `.flow3`). Los números son texto. */
export default function StartSteps() {
  const { t } = useSiteTranslation();
  const k = `${E}.steps`;
  return (
    <Section surface="light">
      <Container>
        <SectionHead title={t(`${k}.title`)} lead={t(`${k}.lead`)} />
        <ol className={styles.flow}>
          {ICONS.map((Icon, i) => (
            <li key={i}>
              <Reveal className={styles.item}>
                <span className={styles.n} aria-hidden="true">
                  {i + 1}
                </span>
                <Icon className={styles.ic} aria-hidden="true" />
                <h3 className={styles.h3}>{t(`${k}.s${i + 1}.title`)}</h3>
                <p className={styles.text}>{t(`${k}.s${i + 1}.text`)}</p>
                <p className={styles.need}>
                  <b>{t(`${k}.needLabel`)}</b>
                  {t(`${k}.s${i + 1}.need`)}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
