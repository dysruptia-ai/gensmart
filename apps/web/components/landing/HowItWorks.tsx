import { PlusCircle, Settings, Rocket, BarChart3 } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import styles from './HowItWorks.module.css';

const STEPS = [
  {
    icon: PlusCircle,
    number: '1',
    title: 'Create',
    description: 'Start from a template or build your own agent from scratch',
  },
  {
    icon: Settings,
    number: '2',
    title: 'Configure',
    description: 'Set personality, knowledge base, and tools',
  },
  {
    icon: Rocket,
    number: '3',
    title: 'Deploy',
    description: 'Connect to WhatsApp or embed on your website instantly',
  },
  {
    icon: BarChart3,
    number: '4',
    title: 'Track',
    description: 'Monitor leads, conversations, and conversions in real-time',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section} aria-label="How it works">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Simple by design</span>
            <h2 className={styles.title}>From Idea to Live Agent in 4 Steps</h2>
            <p className={styles.subtitle}>
              No complex setup, no developer needed. Just you and your AI agent.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.steps}>
          {STEPS.map(({ icon: Icon, number, title, description }, i) => (
            <ScrollReveal key={title} delay={i * 100}>
              <div className={styles.step}>
                <div className={styles.stepVisual}>
                  <div className={styles.stepNumber}>{number}</div>
                  <div className={styles.stepIconWrap}>
                    <Icon size={28} aria-hidden="true" />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={styles.connector} aria-hidden="true" />
                  )}
                </div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>{title}</h3>
                  <p className={styles.stepDesc}>{description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
