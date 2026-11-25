'use client';

import Image from 'next/image';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import SiteLink from '../SiteLink';
import { INDUSTRIES } from '../industries/industriesData';
import styles from './IndustryCards.module.css';

/** "Una página por industria": las 12 tarjetas con foto (design/web: `indCards(…, true)`). */
export default function IndustryCards() {
  const { t } = useSiteTranslation();
  return (
    <ul className={styles.grid}>
      {INDUSTRIES.map((industry, i) => {
        const k = industry.base;
        return (
          <li key={industry.id}>
            <SiteLink to={industry.id} className={styles.card}>
              <span className={styles.wrap} aria-hidden="true">
                <Image
                  src={industry.photo.src}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 400px"
                  className={styles.ph}
                  style={{ objectPosition: industry.photo.position }}
                />
                <i className={styles.n}>{String(i + 1).padStart(2, '0')}</i>
              </span>
              <h3 className={styles.h3}>{t(`${k}.name`)}</h3>
              <p className={styles.short}>{t(`${k}.short`)}</p>
              <p className={styles.subs}>
                {[1, 2, 3].map((n) => t(`${k}.subs.s${n}`)).join(' · ')}
              </p>
              <span className={styles.more}>
                {t('site.solutions.industriesMore')} <span aria-hidden="true">→</span>
              </span>
            </SiteLink>
          </li>
        );
      })}
    </ul>
  );
}
