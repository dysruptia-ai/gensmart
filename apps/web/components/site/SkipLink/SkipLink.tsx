'use client';

import { useTranslation } from '@/hooks/useTranslation';
import styles from './SkipLink.module.css';

/** Primer elemento enfocable de la página: salta al contenido principal (#main). */
export default function SkipLink() {
  const { t } = useTranslation();
  return (
    <a className={styles.skip} href="#main">
      {t('site.a11y.skip')}
    </a>
  );
}
