import { Clock, Wrench, DollarSign, Zap, LayoutDashboard, Sparkles } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import styles from './ProblemSolution.module.css';

const PROBLEMS = [
  {
    icon: Clock,
    text: 'Weeks of setup with complex tools',
  },
  {
    icon: Wrench,
    text: 'Multiple disconnected platforms',
  },
  {
    icon: DollarSign,
    text: 'Expensive developer resources',
  },
];

const SOLUTIONS = [
  {
    icon: Zap,
    text: 'Deploy in minutes, not weeks',
  },
  {
    icon: LayoutDashboard,
    text: 'All-in-one platform',
  },
  {
    icon: Sparkles,
    text: 'No coding required',
  },
];

export function ProblemSolution() {
  return (
    <section className={styles.section} aria-label="Problem vs Solution">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <h2 className={styles.title}>Stop Fighting with Complex Tools</h2>
            <p className={styles.subtitle}>
              You shouldn&apos;t need a developer to automate your customer conversations.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.comparison}>
          <ScrollReveal delay={100}>
            <div className={styles.card + ' ' + styles.oldWay}>
              <div className={styles.cardHeader}>
                <span className={styles.cardBadge + ' ' + styles.badgeDanger}>The Old Way</span>
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
                <span className={styles.cardBadge + ' ' + styles.badgeSuccess}>The GenSmart Way</span>
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
