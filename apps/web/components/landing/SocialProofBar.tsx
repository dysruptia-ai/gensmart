'use client';

import { useTranslation } from '@/hooks/useTranslation';
import styles from './SocialProofBar.module.css';

const LOGOS = [
  'TechFlow',
  'GrowthLab',
  'AutoScale',
  'LeadGenius',
  'SmartReach',
  'ScaleUp',
];

export function SocialProofBar() {
  const { t } = useTranslation();

  return (
    <section className={styles.section} aria-label="Social proof">
      <div className={styles.inner}>
        <p className={styles.text}>
          {t('landing.socialProof', { count: '500' })}
        </p>
        <div className={styles.logoTrack} aria-hidden="true">
          <div className={styles.logoList}>
            {[...LOGOS, ...LOGOS].map((name, i) => (
              <div key={i} className={styles.logoItem}>
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
