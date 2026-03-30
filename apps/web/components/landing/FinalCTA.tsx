'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './FinalCTA.module.css';

export function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className={styles.section} aria-label="Call to action">
      <div className={styles.inner}>
        <div className={styles.decorLeft} aria-hidden="true" />
        <div className={styles.decorRight} aria-hidden="true" />

        <div className={styles.content}>
          <h2 className={styles.title}>
            {t('landing.finalCta.altTitle')}
          </h2>
          <p className={styles.subtitle}>
            {t('landing.finalCta.altSubtitle', { count: '500' })}
          </p>
          <div className={styles.actions}>
            <Link href="/register?code=GENSMART-LAUNCH" className={styles.cta}>
              {t('landing.hero.cta')}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <p className={styles.hint}>{t('landing.finalCta.hint')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
