'use client';

import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../Container';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteLink from '../SiteLink';
import type { SolutionData } from './solutionsData';
import styles from './SolutionMore.module.css';

interface SolutionMoreProps {
  title: string;
  /** Páginas a enlazar, cada una con la primera respuesta de su agente. */
  pages: readonly SolutionData[];
  /** Debajo de la lista (botón al índice). */
  footer?: ReactNode;
}

/** "Explora más": tarjetas de otras páginas de Soluciones (design/web: `.index`). */
export default function SolutionMore({ title, pages, footer }: SolutionMoreProps) {
  const { t } = useSiteTranslation();
  return (
    <Section surface="alt">
      <Container>
        <SectionHead title={title} />
        <ol className={styles.index}>
          {pages.map((other) => {
            const k = other.base;
            const firstOut = other.heroChat.indexOf('out') + 1;
            return (
              <li key={other.id}>
                <SiteLink to={other.id} className={styles.card}>
                  <span className={styles.name}>{t(`${k}.name`)}</span>
                  <span className={styles.short}>{t(`${k}.short`)}</span>
                  <span className={styles.say}>
                    <q className={styles.quote}>{t(`${k}.chat.m${firstOut}`)}</q>
                    <span className={styles.who}>{t(`${k}.label`)}</span>
                  </span>
                  <ArrowRight className={styles.go} size={18} aria-hidden="true" />
                </SiteLink>
              </li>
            );
          })}
        </ol>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </Container>
    </Section>
  );
}
