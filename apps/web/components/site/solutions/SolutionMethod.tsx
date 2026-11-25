'use client';

import type { ReactNode } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../Container';
import Reveal from '../Reveal';
import Section from '../Section';
import SectionHead from '../SectionHead';
import { range, type SolutionData } from './solutionsData';
import styles from './SolutionMethod.module.css';

interface SolutionMethodProps {
  page: SolutionData;
  /** Lo que va después del cierre (el bloque de control de los equipos, un enlace). */
  children?: ReactNode;
}

/** "Cómo trabaja": los pasos con su resultado y el cierre (design/web: `.method`). */
export default function SolutionMethod({ page, children }: SolutionMethodProps) {
  const { t } = useSiteTranslation();
  const k = page.base;
  return (
    <Section surface="dark">
      <Container>
        <SectionHead title={t(`${k}.storyH`)} lead={t(`${k}.storyLead`)} />
        <ol className={styles.method}>
          {range(page.steps).map((i) => (
            <li key={i}>
              <span className={styles.n} aria-hidden="true">
                {i}
              </span>
              <Reveal className={styles.body}>
                <div>
                  <h3 className={styles.h3}>{t(`${k}.method.s${i}.title`)}</h3>
                  <p>{t(`${k}.method.s${i}.text`)}</p>
                </div>
                <p className={styles.out}>
                  <small>{t(`${page.common}.result`)}</small>
                  {t(`${k}.method.s${i}.result`)}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className={styles.close}>{t(`${k}.methodClose`)}</p>
        {children}
      </Container>
    </Section>
  );
}
