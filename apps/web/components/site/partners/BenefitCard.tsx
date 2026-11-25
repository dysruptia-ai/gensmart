'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { isSiteLanguage } from '@/lib/site-routes';
import SiteButton from '../SiteButton';
import { P, programValues } from './partnersData';
import styles from './BenefitCard.module.css';

/** "Ser socio incluye": los 4 puntos del programa (design/web: `.paycard.benefit`). */
export default function BenefitCard() {
  const { t, language } = useSiteTranslation();
  const v = programValues(t, isSiteLanguage(language) ? language : 'en');
  const B = `${P}.benefit`;
  const rows = [
    { value: v.percent, text: t(`${B}.commission`, v) },
    { value: v.bonusLabel, text: t(`${B}.bonus`, v) },
    { value: String(v.days), text: t(`${B}.trial`) },
    { value: t(`${B}.panelValue`), text: t(`${B}.panel`) },
  ];
  return (
    <aside className={styles.card} aria-label={t(`${B}.label`)}>
      <p className={styles.kicker}>{t(`${B}.kicker`)}</p>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.text} className={styles.row}>
            <b className={styles.value}>{row.value}</b>
            <span className={styles.text}>{row.text}</span>
          </li>
        ))}
      </ul>
      <SiteButton to="partnerSignup" size="sm" className={styles.cta}>
        {t(`${B}.cta`)}
      </SiteButton>
    </aside>
  );
}
