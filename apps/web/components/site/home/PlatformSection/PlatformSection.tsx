'use client';

import { useTranslation } from '@/hooks/useTranslation';
import CheckList from '../../CheckList';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import ChannelMap from './ChannelMap';
import styles from './PlatformSection.module.css';

export default function PlatformSection() {
  const { t } = useTranslation();
  return (
    <Section surface="light" className={styles.platform}>
      <Container>
        <SectionHead title={t('site.home.platform.title')} lead={t('site.home.platform.lead')} />
        <div className={styles.block}>
          <div className={styles.copy}>
            <h3 className={styles.h3}>{t('site.home.platform.h3')}</h3>
            <div>
              <p className={styles.lead}>{t('site.home.platform.copy')}</p>
              <CheckList
                className={styles.checks}
                items={[t('site.home.platform.check1'), t('site.home.platform.check2')]}
              />
            </div>
          </div>
          <ChannelMap />
        </div>
      </Container>
    </Section>
  );
}
