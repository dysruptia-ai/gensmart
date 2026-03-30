'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './PricingSection.module.css';

type BillingCycle = 'monthly' | 'yearly';

const PLANS = [
  {
    key: 'free',
    monthlyPrice: 0,
    features: ['1 AI Agent', '50 messages/mo', '25 contacts', 'Web channel only', '1 knowledge file', 'Community support'],
    ctaKey: 'landing.pricing.startFree',
    href: '/register?code=GENSMART-LAUNCH',
    popular: false,
  },
  {
    key: 'starter',
    monthlyPrice: 29,
    features: ['3 AI Agents', '1,000 messages/mo', '500 contacts', 'WhatsApp + Web', 'Voice messages', '5 knowledge files', 'Email support'],
    ctaKey: 'landing.pricing.getStarted',
    href: '/register?plan=starter&code=GENSMART-LAUNCH',
    popular: false,
  },
  {
    key: 'pro',
    monthlyPrice: 79,
    features: ['10 AI Agents', '5,000 messages/mo', '2,000 contacts', 'WhatsApp + Web', 'Voice messages', 'Image analysis', '20 knowledge files', 'Priority support'],
    ctaKey: 'landing.pricing.getStarted',
    href: '/register?plan=pro&code=GENSMART-LAUNCH',
    popular: true,
  },
  {
    key: 'enterprise',
    monthlyPrice: 199,
    features: ['Unlimited Agents', '25,000 messages/mo', 'Unlimited contacts', 'WhatsApp + Web', 'Voice messages', 'Image analysis', 'Unlimited files', 'Dedicated support'],
    ctaKey: 'landing.pricing.contactSales',
    href: 'mailto:sales@gensmart.co',
    popular: false,
  },
];

function getDisplayPrice(monthly: number, cycle: BillingCycle, perMonthLabel: string) {
  if (monthly === 0) return { price: '0', period: perMonthLabel };
  if (cycle === 'yearly') {
    const discounted = Math.round(monthly * 0.8);
    return { price: String(discounted), period: `${perMonthLabel}, billed yearly` };
  }
  return { price: String(monthly), period: perMonthLabel };
}

export function PricingSection() {
  const { t } = useTranslation();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  return (
    <section id="pricing" className={styles.section} aria-label="Pricing">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>{t('landing.pricing.title')}</span>
            <h2 className={styles.title}>{t('landing.pricing.title')}</h2>
            <p className={styles.subtitle}>{t('landing.pricing.subtitle')}</p>

            <div className={styles.toggleWrap} role="group" aria-label="Billing cycle">
              <button
                className={`${styles.toggleBtn} ${cycle === 'monthly' ? styles.active : ''}`}
                onClick={() => setCycle('monthly')}
                aria-pressed={cycle === 'monthly'}
              >
                {t('landing.pricing.monthly')}
              </button>
              <button
                className={`${styles.toggleBtn} ${cycle === 'yearly' ? styles.active : ''}`}
                onClick={() => setCycle('yearly')}
                aria-pressed={cycle === 'yearly'}
              >
                {t('landing.pricing.yearly')}
                <span className={styles.saveBadge}>{t('landing.pricing.save20')}</span>
              </button>
            </div>
          </div>
        </ScrollReveal>

        <div className={styles.plans}>
          {PLANS.map(({ key, monthlyPrice, features, ctaKey, href, popular }, i) => {
            const { price, period } = getDisplayPrice(monthlyPrice, cycle, t('landing.pricing.perMonth'));
            const planName = t(`billing.plans.${key}.name`);
            return (
              <ScrollReveal key={key} delay={i * 80}>
                <div className={`${styles.planCard} ${popular ? styles.popular : ''}`}>
                  {popular && (
                    <div className={styles.popularBadge} aria-label="Most popular plan">
                      {t('landing.pricing.mostPopular')}
                    </div>
                  )}
                  <div className={styles.planHeader}>
                    <h3 className={styles.planName}>{planName}</h3>
                    <div className={styles.priceWrap}>
                      <span className={styles.currency}>$</span>
                      <span className={styles.price}>{price}</span>
                      <span className={styles.period}>{period}</span>
                    </div>
                  </div>
                  <ul className={styles.featureList} aria-label={`${planName} plan features`}>
                    {features.map((f) => (
                      <li key={f} className={styles.feature}>
                        <Check size={14} aria-hidden="true" className={styles.checkIcon} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={href} className={`${styles.planCta} ${popular ? styles.ctaPrimary : styles.ctaSecondary}`}>
                    {t(ctaKey)}
                  </Link>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <div className={styles.footer}>
          <Link href="/pricing" className={styles.compareLink}>
            {t('pricing.compareFeatures')}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
