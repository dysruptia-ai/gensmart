'use client';

import { useTranslation } from '@/hooks/useTranslation';
import CheckList from '../../CheckList';
import Container from '../../Container';
import Section from '../../Section';
import styles from './AgentsSection.module.css';

const A = 'site.product.agents';

export default function AgentsSection() {
  const { t } = useTranslation();
  return (
    <Section id="agentes" rhythm="l">
      <Container>
        <div className={styles.split}>
          <div>
            <h2 className={styles.title}>{t(`${A}.title`)}</h2>
            <p className={styles.lead}>{t(`${A}.lead`)}</p>
          </div>
          <CheckList size="md" items={[t(`${A}.f1`), t(`${A}.f2`), t(`${A}.f3`)]} />
        </div>
        <p className={styles.intro}>{t(`${A}.railIntro`)}</p>
        <ol className={styles.rail}>
          {[1, 2, 3, 4].map((i) => (
            <li key={i}>
              <h3>{t(`${A}.s${i}`)}</h3>
              <p>{t(`${A}.s${i}Desc`)}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
