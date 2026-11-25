'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import SiteButton from '../../SiteButton';
import styles from './AgencyBanner.module.css';

const A = 'site.pricing.agency';

export default function AgencyBanner() {
  const { t } = useSiteTranslation();
  return (
    <section className={styles.section}>
      <Container>
        <div className={styles.card}>
          <div>
            <span className={styles.pill}>{t(`${A}.pill`)}</span>
            <h2 className={styles.title}>{t(`${A}.title`)}</h2>
            <p className={styles.text}>{t(`${A}.text`)}</p>
          </div>
          {/* partners: href null mientras no exista la página (no navega) */}
          <SiteButton to="partners">{t(`${A}.cta`)}</SiteButton>
        </div>
      </Container>
    </section>
  );
}
