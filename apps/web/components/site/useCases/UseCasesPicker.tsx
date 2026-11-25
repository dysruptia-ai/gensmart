'use client';

import { ArrowRight } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import SiteButton from '../SiteButton';
import SiteLink from '../SiteLink';
import { INDUSTRIES } from '../industries/industriesData';
import { TEAMS } from '../teams/teamsData';
import { U } from './useCasesData';
import styles from './UseCasesPicker.module.css';

/**
 * "Cada negocio conversa distinto" (design/web: `.cu-go`, `.cu-gch`, `.cu-gt`, `.cu-act`).
 * Nombres y textos de las páginas de industria y equipo, no copiados.
 */
export default function UseCasesPicker() {
  const { t } = useSiteTranslation();
  const g = `${U}.go`;
  return (
    <>
      <div className={styles.go}>
        <div className={styles.gc}>
          <p className={styles.gq}>{t(`${g}.industriesQ`)}</p>
          <ul className={styles.chips}>
            {INDUSTRIES.map((industry) => (
              <li key={industry.id}>
                <SiteLink to={industry.id} className={styles.chip}>
                  {t(`${industry.base}.name`)}
                </SiteLink>
              </li>
            ))}
          </ul>
          <SiteLink to="industries" className={styles.all}>
            {t(`${g}.allIndustries`)} <ArrowRight size={18} aria-hidden="true" />
          </SiteLink>
        </div>
        <div className={styles.gc}>
          <p className={styles.gq}>{t(`${g}.teamsQ`)}</p>
          <ul className={styles.teams}>
            {TEAMS.map((team) => (
              <li key={team.id}>
                <SiteLink to={team.id} className={styles.team}>
                  <b className={styles.teamName}>{t(`${team.base}.name`)}</b>
                  <span className={styles.teamShort}>{t(`${team.base}.short`)}</span>
                  <ArrowRight className={styles.arrow} size={18} aria-hidden="true" />
                </SiteLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.act}>
        <p>{t(`${g}.actText`)}</p>
        <div className={styles.actions}>
          <SiteButton to="register" size="lg">
            {t(`${g}.actPrimary`)}
          </SiteButton>
          <SiteButton to="contact" variant="ghost" size="lg">
            {t(`${g}.actSecondary`)}
          </SiteButton>
        </div>
      </div>
    </>
  );
}
