'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import LogoTile from '../LogoTile';
import { BRAND_LOGOS } from '../LogoTile/logoData';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteLink from '../SiteLink';
import { COMMON, teamKey, type TeamData } from './teamsData';
import styles from './TeamIntegrations.module.css';

interface TeamIntegrationsProps {
  team: TeamData;
}

/** Integraciones del equipo (design/web: `.logo-strip.ints-strip`). */
export default function TeamIntegrations({ team }: TeamIntegrationsProps) {
  const { t } = useTranslation();
  return (
    <Section surface="dark">
      <Container>
        <SectionHead title={t(`${COMMON}.intsTitle`)} lead={t(`${COMMON}.intsLead`)} />
        <ul
          className={styles.strip}
          aria-label={t(`${COMMON}.intsListLabel`, { team: t(`${teamKey(team.id)}.name`) })}
        >
          {team.integrations.map((name) => {
            const logo = BRAND_LOGOS[name];
            return logo ? (
              <li key={name}>
                <LogoTile logo={logo} className={styles.tile} />
              </li>
            ) : null;
          })}
        </ul>
        <p className={styles.more}>
          {t(`${COMMON}.intsOther`)}{' '}
          <SiteLink to="integrations" className={styles.link}>
            {t(`${COMMON}.intsLink`)} <span aria-hidden="true">→</span>
          </SiteLink>
        </p>
      </Container>
    </Section>
  );
}
