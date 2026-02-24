'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import styles from './PricingSection.module.css';

type BillingCycle = 'monthly' | 'yearly';

const PLANS = [
  {
    name: 'Free',
    monthlyPrice: 0,
    features: ['1 AI Agent', '50 messages/mo', '25 contacts', 'Web channel only', '1 knowledge file', 'Community support'],
    cta: 'Start Free',
    href: '/register',
    popular: false,
  },
  {
    name: 'Starter',
    monthlyPrice: 29,
    features: ['3 AI Agents', '1,000 messages/mo', '500 contacts', 'WhatsApp + Web', '5 knowledge files', 'Email support'],
    cta: 'Start Free Trial',
    href: '/register?plan=starter',
    popular: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 79,
    features: ['10 AI Agents', '5,000 messages/mo', '2,000 contacts', 'WhatsApp + Web', '20 knowledge files', 'Priority support'],
    cta: 'Start Free Trial',
    href: '/register?plan=pro',
    popular: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: 199,
    features: ['Unlimited Agents', '25,000 messages/mo', 'Unlimited contacts', 'WhatsApp + Web', 'Unlimited files', 'Dedicated support'],
    cta: 'Contact Sales',
    href: 'mailto:sales@gensmart.ai',
    popular: false,
  },
];

function getDisplayPrice(monthly: number, cycle: BillingCycle) {
  if (monthly === 0) return { price: '0', period: '/mo' };
  if (cycle === 'yearly') {
    const discounted = Math.round(monthly * 0.8);
    return { price: String(discounted), period: '/mo, billed yearly' };
  }
  return { price: String(monthly), period: '/mo' };
}

export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  return (
    <section id="pricing" className={styles.section} aria-label="Pricing">
      <div className={styles.inner}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Transparent pricing</span>
            <h2 className={styles.title}>Simple, Transparent Pricing</h2>
            <p className={styles.subtitle}>
              Start free. Upgrade when you&apos;re ready. No hidden fees.
            </p>

            <div className={styles.toggleWrap} role="group" aria-label="Billing cycle">
              <button
                className={`${styles.toggleBtn} ${cycle === 'monthly' ? styles.active : ''}`}
                onClick={() => setCycle('monthly')}
                aria-pressed={cycle === 'monthly'}
              >
                Monthly
              </button>
              <button
                className={`${styles.toggleBtn} ${cycle === 'yearly' ? styles.active : ''}`}
                onClick={() => setCycle('yearly')}
                aria-pressed={cycle === 'yearly'}
              >
                Yearly
                <span className={styles.saveBadge}>Save 20%</span>
              </button>
            </div>
          </div>
        </ScrollReveal>

        <div className={styles.plans}>
          {PLANS.map(({ name, monthlyPrice, features, cta, href, popular }, i) => {
            const { price, period } = getDisplayPrice(monthlyPrice, cycle);
            return (
              <ScrollReveal key={name} delay={i * 80}>
                <div className={`${styles.planCard} ${popular ? styles.popular : ''}`}>
                  {popular && (
                    <div className={styles.popularBadge} aria-label="Most popular plan">
                      Most Popular
                    </div>
                  )}
                  <div className={styles.planHeader}>
                    <h3 className={styles.planName}>{name}</h3>
                    <div className={styles.priceWrap}>
                      <span className={styles.currency}>$</span>
                      <span className={styles.price}>{price}</span>
                      <span className={styles.period}>{period}</span>
                    </div>
                  </div>
                  <ul className={styles.featureList} aria-label={`${name} plan features`}>
                    {features.map((f) => (
                      <li key={f} className={styles.feature}>
                        <Check size={14} aria-hidden="true" className={styles.checkIcon} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={href} className={`${styles.planCta} ${popular ? styles.ctaPrimary : styles.ctaSecondary}`}>
                    {cta}
                  </Link>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <div className={styles.footer}>
          <Link href="/pricing" className={styles.compareLink}>
            Compare all features
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
