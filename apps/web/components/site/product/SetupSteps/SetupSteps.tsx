'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import { ENTRY_PRICE } from '../productData';
import styles from './SetupSteps.module.css';

const S = 'site.product.steps';

/** "Tu agente, en tres pasos" (design/web: `.steps.steps-3`). */
export default function SetupSteps() {
  const { t } = useSiteTranslation();
  return (
    <Section surface="light" rhythm="l">
      <Container>
        <SectionHead title={t(`${S}.title`)} lead={t(`${S}.lead`)} />
        <ol className={styles.steps}>
          {[1, 2, 3].map((i) => (
            <li key={i} className={styles.step}>
              <h3>{t(`${S}.s${i}`)}</h3>
              <p>{t(`${S}.s${i}Desc`)}</p>
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          <SiteButton to="pricing" variant="ghost">
            {t(`${S}.cta`, { price: ENTRY_PRICE })}
          </SiteButton>
        </div>
      </Container>
    </Section>
  );
}
