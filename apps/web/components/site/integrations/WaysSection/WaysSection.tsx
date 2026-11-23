'use client';

import { Blocks, Braces, Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Container from '../../Container';
import Section from '../../Section';
import SectionHead from '../../SectionHead';
import { customFunctionCells, mcpServerCells, type PlanLimitCell } from '../integrationsData';
import styles from './WaysSection.module.css';

const W = 'site.integrations.ways';

interface WayProps {
  n: number;
  icon: ReactNode;
  title: string;
  desc: string;
  whenLabel: string;
  when: string;
  footer: ReactNode;
}

function Way({ n, icon, title, desc, whenLabel, when, footer }: WayProps) {
  return (
    <li className={styles.way}>
      <div className={styles.head} aria-hidden="true">
        <span className={styles.n}>{String(n).padStart(2, '0')}</span>
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <p className={styles.when}>
        <b>{whenLabel}</b> {when}
      </p>
      {footer}
    </li>
  );
}

function PlanLimits({ label, cells }: { label: string; cells: PlanLimitCell[] }) {
  return (
    <div role="group" aria-label={label} className={styles.footer}>
      <dl className={styles.plan}>
        {cells.map((c) => (
          <div key={c.plan}>
            <dt>{c.plan}</dt>
            <dd className={c.off ? styles.off : undefined}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** "Tres formas de conectar": los límites por plan salen de `PLAN_LIMITS`. */
export default function WaysSection() {
  const { t } = useTranslation();
  const whenLabel = t(`${W}.when`);
  const byPlan = t(`${W}.byPlan`);
  return (
    <Section rhythm="m">
      <Container>
        <SectionHead title={t(`${W}.title`)} lead={t(`${W}.lead`)} />
        <ol className={styles.ways}>
          <Way
            n={1}
            icon={<Link2 className={styles.icon} strokeWidth={1.5} />}
            title={t(`${W}.w1`)}
            desc={t(`${W}.w1Desc`)}
            whenLabel={whenLabel}
            when={t(`${W}.w1When`)}
            footer={
              <div className={styles.footer}>
                <dl className={`${styles.plan} ${styles.one}`}>
                  <div>
                    <dt>{t(`${W}.w1How`)}</dt>
                    <dd>{t(`${W}.w1HowValue`)}</dd>
                  </div>
                </dl>
              </div>
            }
          />
          <Way
            n={2}
            icon={<Braces className={styles.icon} strokeWidth={1.5} />}
            title={t(`${W}.w2`)}
            desc={t(`${W}.w2Desc`)}
            whenLabel={whenLabel}
            when={t(`${W}.w2When`)}
            footer={<PlanLimits label={byPlan} cells={customFunctionCells(t)} />}
          />
          <Way
            n={3}
            icon={<Blocks className={styles.icon} strokeWidth={1.5} />}
            title={t(`${W}.w3`)}
            desc={t(`${W}.w3Desc`)}
            whenLabel={whenLabel}
            when={t(`${W}.w3When`)}
            footer={<PlanLimits label={byPlan} cells={mcpServerCells(t)} />}
          />
        </ol>
      </Container>
    </Section>
  );
}
