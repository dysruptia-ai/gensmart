'use client';

import { Clock, Wrench, DollarSign, Zap, LayoutDashboard, Sparkles } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './ProblemSolution.module.css';

export function ProblemSolution() {
  const { t } = useTranslation();

  const PROBLEMS = [
    { icon: Clock, text: t('landing.problemSolution.problems.setup') },
    { icon: Wrench, text: t('landing.problemSolution.problems.disconnected') },
    { icon: DollarSign, text: t('landing.problemSolution.problems.expensive') },
  ];

  const SOLUTIONS = [
    { icon: Zap, text: t('landing.problemSolution.solutions.deploy') },
    { icon: LayoutDashboard, text: t('landing.problemSolution.solutions.allInOne') },
    { icon: Sparkles, text: t('landing.problemSolution.solutions.noCode') },
  ];

  return (
    <section className={styles.section} aria-label="Problem vs Solution">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <h2 className={styles.title}>{t('landing.problemSolution.title')}</h2>
            <p className={styles.subtitle}>{t('landing.problemSolution.subtitle')}</p>
          </div>
        </ScrollReveal>

        <div className={styles.comparison}>
          <ScrollReveal delay={100}>
            <div className={styles.card + ' ' + styles.oldWay}>
              <div className={styles.cardHeader}>
                <span className={styles.cardBadge + ' ' + styles.badgeDanger}>{t('landing.problemSolution.oldWay')}</span>
              </div>
              <ul className={styles.itemList}>
                {PROBLEMS.map(({ icon: Icon, text }) => (
                  <li key={text} className={styles.item}>
                    <span className={styles.iconWrap + ' ' + styles.iconDanger}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <div className={styles.vs} aria-hidden="true">VS</div>

          <ScrollReveal delay={200}>
            <div className={styles.card + ' ' + styles.newWay}>
              <div className={styles.cardHeader}>
                <span className={styles.cardBadge + ' ' + styles.badgeSuccess}>{t('landing.problemSolution.newWay')}</span>
              </div>
              <ul className={styles.itemList}>
                {SOLUTIONS.map(({ icon: Icon, text }) => (
                  <li key={text} className={styles.item}>
                    <span className={styles.iconWrap + ' ' + styles.iconSuccess}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
