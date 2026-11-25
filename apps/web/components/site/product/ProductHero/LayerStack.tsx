'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import styles from './LayerStack.module.css';

const H = 'site.product.hero';
const SCORE = 8.4;

/** Las cuatro capas (canal, agente, CRM y agenda): lista con texto real; el cable y la barra son decorativos. */
export default function LayerStack() {
  const { t } = useSiteTranslation();
  return (
    <div className={styles.stack}>
      <span className={styles.wire} aria-hidden="true">
        <i />
      </span>
      <ol className={styles.layers} aria-label={t(`${H}.layersLabel`)}>
        <li className={`${styles.layer} ${styles.l1}`}>
          <p className={styles.key}>
            {t(`${H}.l1`)}
            <em>{t(`${H}.l1Value`)}</em>
          </p>
          <p className={styles.bubble}>{t(`${H}.l1Msg`)}</p>
        </li>
        <li className={`${styles.layer} ${styles.l2}`}>
          <p className={styles.key}>
            {t(`${H}.l2`)}
            <em>{t(`${H}.l2Value`)}</em>
          </p>
          <ul className={styles.tasks}>
            <li>{t(`${H}.l2a`)}</li>
            <li>{t(`${H}.l2b`)}</li>
            <li>{t(`${H}.l2c`)}</li>
          </ul>
        </li>
        <li className={`${styles.layer} ${styles.l3}`}>
          <p className={styles.key}>
            {t(`${H}.l3`)}
            <em>{t(`${H}.l3Value`)}</em>
          </p>
          <p className={styles.score}>
            <b>
              <span className={styles.srOnly}>{t(`${H}.l3Score`)}: </span>
              {SCORE}
            </b>
            <span className={styles.bar} aria-hidden="true">
              <i style={{ width: `${SCORE * 10}%` }} />
            </span>
          </p>
          <p className={styles.chip}>{t(`${H}.l3Chip`)}</p>
        </li>
        <li className={`${styles.layer} ${styles.l4}`}>
          <p className={styles.key}>
            {t(`${H}.l4`)}
            <em>{t(`${H}.l4Value`)}</em>
          </p>
          <p className={styles.slot}>
            <b>{t(`${H}.l4Day`)}</b>
            <span>{t(`${H}.l4Time`)}</span>
          </p>
        </li>
      </ol>
    </div>
  );
}
