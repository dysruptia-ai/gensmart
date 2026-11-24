'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import GlowBackdrop from '../../GlowBackdrop';
import SiteButton from '../../SiteButton';
import styles from './FinalCtaSection.module.css';

const P = 'site.home.cta';

interface FinalCtaSectionProps {
  /** Textos propios (p. ej. Contacto). Sin ellos, el CTA del home. */
  titleBefore?: string;
  titleAccent?: string;
  lead?: ReactNode;
  primaryLabel?: string;
  /** `false` quita el botón secundario "Agenda una demo" (en Contacto no tiene sentido). */
  showDemo?: boolean;
}

export default function FinalCtaSection({
  titleBefore,
  titleAccent,
  lead,
  primaryLabel,
  showDemo = true,
}: FinalCtaSectionProps = {}) {
  const { t } = useTranslation();
  return (
    <section className={styles.cta}>
      <GlowBackdrop variant="cta" />
      <div className={styles.content}>
        <h2 className={styles.title}>
          {titleBefore ?? t(`${P}.titleBefore`)}{' '}
          <span className={styles.accent}>{titleAccent ?? t(`${P}.titleAccent`)}</span>
        </h2>
        <p className={styles.lead}>{lead ?? t(`${P}.lead`)}</p>
        <div className={styles.actions}>
          <SiteButton to="register" size="lg" className={styles.action}>
            {primaryLabel ?? t(`${P}.primary`)}
          </SiteButton>
          {showDemo ? (
            <SiteButton to="contact" variant="ghost" size="lg" className={styles.action}>
              {t(`${P}.demo`)}
            </SiteButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
