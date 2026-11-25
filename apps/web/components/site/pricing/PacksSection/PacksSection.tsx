'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import SectionHead from '../../SectionHead';
import { packs, packsNote } from '../pricingData';
import styles from './PacksSection.module.css';

const P = 'site.pricing.packs';

export default function PacksSection() {
  const { t, language } = useSiteTranslation();
  return (
    <section className={styles.section}>
      <Container>
        <SectionHead title={t(`${P}.title`)} lead={t(`${P}.lead`)} />
        <ul className={styles.packs}>
          {packs(t, language).map((pack) => (
            <li key={pack.messages} className={styles.pack}>
              <b>{pack.messages}</b>
              <span className={styles.price}>${pack.price}</span>
              <small>{t(`${P}.oneTime`)}</small>
            </li>
          ))}
        </ul>
        <p className={styles.note}>{packsNote(t)}</p>
      </Container>
    </section>
  );
}
