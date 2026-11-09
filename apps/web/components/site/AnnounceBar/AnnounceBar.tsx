'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import SiteLink from '../SiteLink';
import styles from './AnnounceBar.module.css';

export default function AnnounceBar() {
  const { t } = useTranslation();
  return (
    <div className={styles.bar} role="region" aria-label={t('site.announce.region')}>
      <Container className={styles.inner}>
        <span className={styles.tag}>{t('site.announce.tag')}</span>
        <span className={styles.text}>{t('site.announce.text')}</span>
        <SiteLink to="pricing" className={styles.link}>
          {t('site.announce.cta')}
          <ArrowRight size={15} aria-hidden="true" />
        </SiteLink>
      </Container>
    </div>
  );
}
