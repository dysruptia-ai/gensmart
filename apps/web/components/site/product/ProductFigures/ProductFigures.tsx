'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import Section from '../../Section';
import { SITE_TRIAL_DAYS } from '../../siteTrial';
import { CHANNEL_COUNT, SETUP_STEPS, toolsCount } from '../productData';
import styles from './ProductFigures.module.css';

const F = 'site.product.figs';

/** Cifras (design/web: `.pr-figs`). Todas salen del código. */
export default function ProductFigures() {
  const { t, language } = useTranslation();
  const figures = [
    { value: String(CHANNEL_COUNT), label: t(`${F}.channels`) },
    { value: `${toolsCount(language)}+`, label: t(`${F}.tools`) },
    { value: String(SETUP_STEPS), label: t(`${F}.steps`) },
    { value: String(SITE_TRIAL_DAYS), label: t(`${F}.days`) },
  ];
  return (
    <Section rhythm="m" className={styles.figs}>
      <Container>
        <ul className={styles.list} aria-label={t(`${F}.label`)}>
          {figures.map((f) => (
            <li key={f.label}>
              <strong>{f.value}</strong> <span>{f.label}</span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
