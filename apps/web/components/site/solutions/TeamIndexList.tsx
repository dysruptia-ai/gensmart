'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import SiteLink from '../SiteLink';
import { TEAMS } from '../teams/teamsData';
import styles from './TeamIndexList.module.css';

/** "Entra por la función": los 6 equipos (design/web: `.index.index-lg.index-noimg`). */
export default function TeamIndexList() {
  const { t } = useTranslation();
  return (
    <ol className={styles.index}>
      {TEAMS.map((team, i) => (
        <li key={team.id}>
          <SiteLink to={team.id} className={styles.card}>
            <span className={styles.n} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={styles.name}>{t(`${team.base}.name`)}</span>
            <span className={styles.short}>{t(`${team.base}.short`)}</span>
            <ArrowRight className={styles.go} size={18} aria-hidden="true" />
          </SiteLink>
        </li>
      ))}
    </ol>
  );
}
