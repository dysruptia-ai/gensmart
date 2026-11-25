'use client';

import type { ReactNode } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import type { SiteLinkKey } from '@/lib/site-links';
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
  /** Destino del botón principal (por defecto, el registro). */
  primaryTo?: SiteLinkKey;
  /** `false` quita el botón secundario "Agenda una demo" (en Contacto no tiene sentido). */
  showDemo?: boolean;
}

export default function FinalCtaSection({
  titleBefore,
  titleAccent,
  lead,
  primaryLabel,
  primaryTo = 'register',
  showDemo = true,
}: FinalCtaSectionProps = {}) {
  const { t } = useSiteTranslation();
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
          <SiteButton to={primaryTo} size="lg" className={styles.action}>
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
