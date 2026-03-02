'use client';

import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './HeroSection.module.css';

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className={styles.hero} aria-label="Hero">
      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            {t('landing.hero.badge')}
          </div>
          <h1 className={styles.headline}>
            {t('landing.hero.titleStart')}{' '}
            <span className={styles.highlight}>{t('landing.hero.titleHighlight')}</span>
            {t('landing.hero.titleEnd')}
          </h1>
          <p className={styles.subheadline}>
            {t('landing.hero.subtitle')}
          </p>
          <div className={styles.ctas}>
            <Link href="/register" className={styles.ctaPrimary}>
              {t('landing.hero.cta')}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className={styles.ctaSecondary}>
              <span className={styles.playIcon} aria-hidden="true">
                <Play size={14} />
              </span>
              {t('landing.hero.ctaSecondary')}
            </a>
          </div>
          <p className={styles.hint}>{t('landing.hero.freeForeverHint')}</p>
        </div>

        <div className={styles.visual} aria-hidden="true">
          <div className={styles.dashboardMockup}>
            <div className={styles.mockupHeader}>
              <div className={styles.mockupDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
              <span className={styles.mockupTitle}>GenSmart Dashboard</span>
            </div>

            <div className={styles.mockupBody}>
              {/* Stats row — decorative mockup, not translated */}
              <div className={styles.statsRow}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Leads Today</span>
                  <span className={styles.statValue}>24</span>
                  <span className={styles.statChange}>+18%</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Active Chats</span>
                  <span className={styles.statValue}>7</span>
                  <span className={styles.statChange}>Live</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Avg Score</span>
                  <span className={styles.statValue}>8.4</span>
                  <span className={styles.statChange}>High</span>
                </div>
              </div>

              {/* Agent cards */}
              <div className={styles.agentList}>
                <div className={styles.agentCard}>
                  <div className={styles.agentAvatar} style={{ background: '#25D366' }}>S</div>
                  <div className={styles.agentInfo}>
                    <span className={styles.agentName}>Sales Bot</span>
                    <span className={styles.agentStatus}>WhatsApp · Active</span>
                  </div>
                  <span className={styles.agentBadge}>12 leads</span>
                </div>
                <div className={styles.agentCard}>
                  <div className={styles.agentAvatar} style={{ background: '#3B82F6' }}>S</div>
                  <div className={styles.agentInfo}>
                    <span className={styles.agentName}>Support Agent</span>
                    <span className={styles.agentStatus}>Web · Active</span>
                  </div>
                  <span className={styles.agentBadge}>8 leads</span>
                </div>
                <div className={styles.agentCard}>
                  <div className={styles.agentAvatar} style={{ background: '#F59E0B' }}>B</div>
                  <div className={styles.agentInfo}>
                    <span className={styles.agentName}>Booking Bot</span>
                    <span className={styles.agentStatus}>WhatsApp · Active</span>
                  </div>
                  <span className={styles.agentBadge}>4 leads</span>
                </div>
              </div>

              {/* Mini chat preview */}
              <div className={styles.chatPreview}>
                <div className={styles.chatBubble + ' ' + styles.chatUser}>
                  Hi, I need help with pricing
                </div>
                <div className={styles.chatBubble + ' ' + styles.chatAgent}>
                  Sure! Our Pro plan starts at $79/mo. Let me get your details...
                </div>
                <div className={styles.chatTyping}>
                  <span /><span /><span />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
