'use client';

import { useTranslation } from '@/hooks/useTranslation';
import { LIMITS, U } from './useCasesData';
import styles from './UseCasesLimits.module.css';

/** "Tú defines hasta dónde llega el agente" (design/web: `.cu-lim`, `.cu-tag`). */
export default function UseCasesLimits() {
  const { t } = useTranslation();
  return (
    <dl className={styles.lim}>
      {LIMITS.map((configurable, i) => {
        const k = `${U}.limits.items.l${i + 1}`;
        return (
          <div key={k}>
            <dt className={styles.dt}>
              {t(`${k}.k`)}
              <span className={configurable ? styles.tag : `${styles.tag} ${styles.fix}`}>
                {t(configurable ? `${U}.limits.configurable` : `${U}.limits.fixed`)}
              </span>
            </dt>
            <dd className={styles.dd}>{t(`${k}.v`)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
