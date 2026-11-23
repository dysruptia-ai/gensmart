'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChatBubble from '../../ChatBubble';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import styles from './UseCasesSection.module.css';

const P = 'site.home.useCases';

type UseCaseId = 'clinic' | 'store' | 'realEstate' | 'restaurant';
const CASES: readonly UseCaseId[] = ['clinic', 'store', 'realEstate', 'restaurant'];

export default function UseCasesSection() {
  const { t } = useTranslation();
  const k = (id: UseCaseId, field: string) => t(`${P}.${id}.${field}`);

  return (
    <Section surface="alt" className={styles.useCases}>
      <Container>
        <SectionHead title={t(`${P}.title`)} lead={t(`${P}.lead`)} />
        <ul className={styles.grid}>
          {CASES.map((id) => (
            <li key={id} className={styles.card}>
              <h3 className={styles.head}>
                <i className={styles.dot} aria-hidden="true" />
                <span>
                  <b>{k(id, 'industry')}</b> · {k(id, 'task')}
                </span>
              </h3>
              <ChatBubble direction="in">{k(id, 'in')}</ChatBubble>
              <ChatBubble direction="out">{k(id, 'out')}</ChatBubble>
              <p className={styles.chips}>
                <span className={styles.chip}>{k(id, 'chip')}</span>
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
