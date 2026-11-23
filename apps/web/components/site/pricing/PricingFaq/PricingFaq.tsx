'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import SiteButton from '../../SiteButton';
import { faqItems } from '../pricingData';
import styles from './PricingFaq.module.css';

const F = 'site.pricing.faq';

/** Preguntas en <details>/<summary>: abren con teclado y se leen sin JS. Mismo texto que el JSON-LD. */
export default function PricingFaq() {
  const { t, language } = useTranslation();
  return (
    <section className={styles.section} aria-labelledby="faq-heading">
      <Container className={styles.split}>
        <div className={styles.side}>
          <p className={styles.kicker}>{t(`${F}.kicker`)}</p>
          <h2 id="faq-heading" className={styles.title}>
            {t(`${F}.titleBefore`)} <span className={styles.accent}>{t(`${F}.titleAccent`)}</span>
          </h2>
          <p className={styles.help}>
            {t(`${F}.helpBefore`)} <span className={styles.accent}>{t(`${F}.helpAccent`)}</span>{' '}
            {t(`${F}.helpAfter`)}
          </p>
          <SiteButton to="contact" variant="ghost">
            {t(`${F}.cta`)}
          </SiteButton>
        </div>
        <div className={styles.faq}>
          {faqItems(t, language).map((item, i) => (
            <details key={item.question} className={styles.item} open={i === 0}>
              <summary className={styles.summary}>
                <span className={styles.num} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={styles.question}>{item.question}</span>
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
