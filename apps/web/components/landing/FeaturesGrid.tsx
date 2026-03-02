'use client';

import {
  Bot,
  MessageCircle,
  Users,
  GitBranch,
  Calendar,
  BookOpen,
  UserCheck,
  Plug,
} from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './FeaturesGrid.module.css';

export function FeaturesGrid() {
  const { t } = useTranslation();

  const FEATURES = [
    { icon: Bot, titleKey: 'landing.features.aiAgents.title', descKey: 'landing.features.aiAgents.description' },
    { icon: MessageCircle, titleKey: 'landing.features.channelsFeature.title', descKey: 'landing.features.channelsFeature.description' },
    { icon: Users, titleKey: 'landing.features.smartCrm.title', descKey: 'landing.features.smartCrm.description' },
    { icon: GitBranch, titleKey: 'landing.features.salesFunnelFeature.title', descKey: 'landing.features.salesFunnelFeature.description' },
    { icon: Calendar, titleKey: 'landing.features.schedulingFeature.title', descKey: 'landing.features.schedulingFeature.description' },
    { icon: BookOpen, titleKey: 'landing.features.knowledgeBaseFeature.title', descKey: 'landing.features.knowledgeBaseFeature.description' },
    { icon: UserCheck, titleKey: 'landing.features.humanTakeoverFeature.title', descKey: 'landing.features.humanTakeoverFeature.description' },
    { icon: Plug, titleKey: 'landing.features.customFunctionsMcp.title', descKey: 'landing.features.customFunctionsMcp.description' },
  ];

  return (
    <section id="features" className={styles.section} aria-label="Features">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>{t('landing.features.eyebrow')}</span>
            <h2 className={styles.title}>{t('landing.features.gridTitle')}</h2>
            <p className={styles.subtitle}>{t('landing.features.gridSubtitle')}</p>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {FEATURES.map(({ icon: Icon, titleKey, descKey }, i) => (
            <ScrollReveal key={titleKey} delay={i * 60}>
              <article className={styles.card}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <Icon size={24} />
                </div>
                <h3 className={styles.cardTitle}>{t(titleKey)}</h3>
                <p className={styles.cardDesc}>{t(descKey)}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
