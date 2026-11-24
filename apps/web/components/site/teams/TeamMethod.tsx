'use client';

import { useTranslation } from '@/hooks/useTranslation';
import Container from '../Container';
import Reveal from '../Reveal';
import Section from '../Section';
import SectionHead from '../SectionHead';
import SiteButton from '../SiteButton';
import { COMMON, range, teamKey, type TeamData } from './teamsData';
import styles from './TeamMethod.module.css';

interface TeamMethodProps {
  team: TeamData;
}

/** "Cómo trabaja": los pasos (`.method`) y el bloque de control (`.tm-ctl`, `.cu-lim`). */
export default function TeamMethod({ team }: TeamMethodProps) {
  const { t } = useTranslation();
  const k = teamKey(team.id);
  return (
    <Section surface="dark">
      <Container>
        <SectionHead title={t(`${k}.storyH`)} lead={t(`${k}.storyLead`)} />
        <ol className={styles.method}>
          {range(team.steps).map((i) => (
            <li key={i}>
              <span className={styles.n} aria-hidden="true">
                {i}
              </span>
              <Reveal className={styles.body}>
                <div>
                  <h3 className={styles.h3}>{t(`${k}.method.s${i}.title`)}</h3>
                  <p>{t(`${k}.method.s${i}.text`)}</p>
                </div>
                <p className={styles.out}>
                  <small>{t(`${COMMON}.result`)}</small>
                  {t(`${k}.method.s${i}.result`)}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className={styles.close}>{t(`${k}.methodClose`)}</p>

        <div className={styles.ctl}>
          <h3 className={styles.ctlTitle}>{t(`${k}.control.title`)}</h3>
          <p className={styles.ctlLead}>{t(`${k}.control.lead`)}</p>
          <dl className={styles.rules}>
            {range(team.controls).map((i) => (
              <div key={i}>
                <dt>
                  {t(`${k}.control.r${i}.title`)}
                  <span className={styles.tag}>{t(`${COMMON}.youConfigure`)}</span>
                </dt>
                <dd>{t(`${k}.control.r${i}.text`)}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.actions}>
            <SiteButton to="register">{t(`${COMMON}.primary`)}</SiteButton>
            <SiteButton to="contact" variant="ghost">
              {t(`${COMMON}.talk`)}
            </SiteButton>
          </div>
        </div>
      </Container>
    </Section>
  );
}
