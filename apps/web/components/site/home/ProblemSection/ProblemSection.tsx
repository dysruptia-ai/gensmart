'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import styles from './ProblemSection.module.css';

type ChannelId = 'instagram' | 'whatsapp' | 'messenger' | 'email';

const ROWS: Array<{ id: string; channel: ChannelId }> = [
  { id: 'r1', channel: 'instagram' },
  { id: 'r2', channel: 'whatsapp' },
  { id: 'r3', channel: 'messenger' },
  { id: 'r4', channel: 'whatsapp' },
  { id: 'r5', channel: 'email' },
];

export default function ProblemSection() {
  const { t } = useTranslation();
  return (
    <Section surface="dark" className={styles.problem}>
      <Container className={styles.content}>
        <SectionHead title={t('site.home.problem.title')} lead={t('site.home.problem.lead')} />

        <ul className={styles.list} aria-label={t('site.home.problem.listLabel')}>
          {ROWS.map((row) => (
            <li key={row.id} className={styles.row}>
              <span className={styles.time}>{t(`site.home.problem.rows.${row.id}.time`)}</span>
              <span className={`${styles.channel} ${styles[row.channel]}`}>
                {t(`site.home.problem.ch.${row.channel}`)}
              </span>
              <span className={styles.msg}>{t(`site.home.problem.rows.${row.id}.msg`)}</span>
              <span className={styles.status}>{t('site.home.problem.status')}</span>
            </li>
          ))}
        </ul>

        <div className={styles.foot}>
          <b>{t('site.home.problem.footBold')}</b>
          <span>{t('site.home.problem.footNote')}</span>
        </div>
      </Container>
    </Section>
  );
}
