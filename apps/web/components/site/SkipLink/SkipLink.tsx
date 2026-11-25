'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import styles from './SkipLink.module.css';

/** Primer elemento enfocable de la página: salta al contenido principal (#main). */
export default function SkipLink() {
  const { t } = useSiteTranslation();
  return (
    <a className={styles.skip} href="#main">
      {t('site.a11y.skip')}
    </a>
  );
}
