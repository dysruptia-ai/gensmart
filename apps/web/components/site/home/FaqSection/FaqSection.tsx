'use client';

import { Plus } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import styles from './FaqSection.module.css';

const P = 'site.home.faq';
const IDS = [1, 2, 3, 4] as const;

export default function FaqSection() {
  const { t } = useTranslation();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: IDS.map((i) => ({
      '@type': 'Question',
      name: t(`${P}.q${i}`),
      acceptedAnswer: { '@type': 'Answer', text: t(`${P}.a${i}`) },
    })),
  };

  return (
    <Section surface="light" className={styles.faq}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <Container className={styles.layout}>
        <SectionHead title={t(`${P}.title`)} className={styles.head} />
        <div>
          {IDS.map((i) => (
            <details key={i} className={styles.item}>
              <summary className={styles.summary}>
                {t(`${P}.q${i}`)}
                <Plus size={16} aria-hidden="true" className={styles.icon} />
              </summary>
              <p className={styles.answer}>{t(`${P}.a${i}`)}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
