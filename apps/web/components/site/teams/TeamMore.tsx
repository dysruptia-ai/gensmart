'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteLink from '../SiteLink';
import { COMMON, otherTeams, teamKey, type TeamData } from './teamsData';
import styles from './TeamMore.module.css';

interface TeamMoreProps {
  team: TeamData;
}

/** "Explora más soluciones": los 3 equipos siguientes en orden circular (design/web: `.index`). */
export default function TeamMore({ team }: TeamMoreProps) {
  const { t } = useTranslation();
  return (
    <Section surface="alt">
      <Container>
        <SectionHead title={t(`${COMMON}.moreTitle`)} />
        <ol className={styles.index}>
          {otherTeams(team.id).map((other) => {
            const k = teamKey(other.id);
            const firstOut = other.heroChat.indexOf('out') + 1;
            return (
              <li key={other.id}>
                <SiteLink to={other.id} className={styles.card}>
                  <span className={styles.name}>{t(`${k}.name`)}</span>
                  <span className={styles.short}>{t(`${k}.short`)}</span>
                  <span className={styles.say}>
                    <q className={styles.quote}>{t(`${k}.chat.m${firstOut}`)}</q>
                    <span className={styles.who}>{t(`${k}.label`)}</span>
                  </span>
                  <ArrowRight className={styles.go} size={18} aria-hidden="true" />
                </SiteLink>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
