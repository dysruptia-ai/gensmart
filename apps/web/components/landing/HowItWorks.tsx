'use client';

import { PlusCircle, Settings, Rocket, BarChart3 } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './HowItWorks.module.css';

export function HowItWorks() {
  const { t } = useTranslation();

  const STEPS = [
    { icon: PlusCircle, number: '1', titleKey: 'landing.howItWorks.gridStep1.title', descKey: 'landing.howItWorks.gridStep1.description' },
    { icon: Settings, number: '2', titleKey: 'landing.howItWorks.gridStep2.title', descKey: 'landing.howItWorks.gridStep2.description' },
    { icon: Rocket, number: '3', titleKey: 'landing.howItWorks.gridStep3.title', descKey: 'landing.howItWorks.gridStep3.description' },
    { icon: BarChart3, number: '4', titleKey: 'landing.howItWorks.gridStep4.title', descKey: 'landing.howItWorks.gridStep4.description' },
  ];

  return (
    <section id="how-it-works" className={styles.section} aria-label="How it works">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>{t('landing.howItWorks.eyebrow')}</span>
            <h2 className={styles.title}>{t('landing.howItWorks.gridTitle')}</h2>
            <p className={styles.subtitle}>{t('landing.howItWorks.gridSubtitle')}</p>
          </div>
        </ScrollReveal>

        <div className={styles.steps}>
          {STEPS.map(({ icon: Icon, number, titleKey, descKey }, i) => (
            <ScrollReveal key={titleKey} delay={i * 100}>
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
                  <h3 className={styles.stepTitle}>{t(titleKey)}</h3>
                  <p className={styles.stepDesc}>{t(descKey)}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
