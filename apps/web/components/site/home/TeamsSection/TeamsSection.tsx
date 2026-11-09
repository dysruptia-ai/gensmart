'use client';

import { useTranslation } from '@/hooks/useTranslation';
import type { SiteLinkKey } from '@/lib/site-links';
import CheckList from '../../CheckList';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import SiteButton from '../../SiteButton';
import SiteLink from '../../SiteLink';
import styles from './TeamsSection.module.css';

const AGENT_COUNT = 6;
const HUMAN_COUNT = 5;
const TEAM_KEYS: SiteLinkKey[] = [
  'teamSales',
  'teamCustomerSupport',
  'teamMarketing',
  'teamOperationsBooking',
  'teamHumanResources',
  'teamCollections',
];

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

export default function TeamsSection() {
  const { t } = useTranslation();
  const p = 'site.home.teams';
  return (
    <Section surface="alt" className={styles.teams}>
      <Container>
        <SectionHead title={t(`${p}.title`)} lead={t(`${p}.lead`)} />

        <div className={styles.split}>
          <div className={styles.agent}>
            <h3 className={styles.h3}>{t(`${p}.agentTitle`)}</h3>
            <CheckList size="md" items={range(AGENT_COUNT).map((i) => t(`${p}.agent${i}`))} />
          </div>
          <div className={styles.human}>
            <h3 className={`${styles.h3} ${styles.h3Soft}`}>{t(`${p}.humanTitle`)}</h3>
            <ul className={styles.humanList}>
              {range(HUMAN_COUNT).map((i) => (
                <li key={i}>{t(`${p}.human${i}`)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.links}>
          <span className={styles.linksLabel}>{t(`${p}.linksLabel`)}</span>
          <nav className={styles.pills} aria-label={t(`${p}.linksNav`)}>
            {TEAM_KEYS.map((key) => (
              <SiteLink key={key} to={key} className={styles.pill}>
                {t(`${p}.teams.${key}`)}
              </SiteLink>
            ))}
          </nav>
        </div>

        <div className={styles.cta}>
          <SiteButton to="industries" variant="ghost">
            {t(`${p}.cta`)}
          </SiteButton>
        </div>
      </Container>
    </Section>
  );
}
