'use client';

import { useTranslation } from '@/hooks/useTranslation';
import SiteButton from '../SiteButton';
import { range } from '../solutions/solutionsData';
import { TEAM_COMMON, type TeamData } from './teamsData';
import styles from './TeamControl.module.css';

interface TeamControlProps {
  team: TeamData;
}

/** "Tú defines hasta dónde llega el agente": solo en equipos (design/web: `.tm-ctl`, `.cu-lim`). */
export default function TeamControl({ team }: TeamControlProps) {
  const { t } = useTranslation();
  const k = team.base;
  return (
    <div className={styles.ctl}>
      <h3 className={styles.ctlTitle}>{t(`${k}.control.title`)}</h3>
      <p className={styles.ctlLead}>{t(`${k}.control.lead`)}</p>
      <dl className={styles.rules}>
        {range(team.controls).map((i) => (
          <div key={i}>
            <dt>
              {t(`${k}.control.r${i}.title`)}
              <span className={styles.tag}>{t(`${TEAM_COMMON}.youConfigure`)}</span>
            </dt>
            <dd>{t(`${k}.control.r${i}.text`)}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <SiteButton to="register">{t(`${TEAM_COMMON}.primary`)}</SiteButton>
        <SiteButton to="contact" variant="ghost">
          {t(`${TEAM_COMMON}.talk`)}
        </SiteButton>
      </div>
    </div>
  );
}
