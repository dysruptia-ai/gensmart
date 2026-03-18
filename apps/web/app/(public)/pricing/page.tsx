'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './pricing.module.css';

type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    highlight: false,
    ctaKey: 'pricing.getStarted' as const,
    href: '/register',
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    highlight: false,
    ctaKey: 'pricing.startFreeTrial' as const,
    href: '/register?plan=starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 79,
    highlight: true,
    ctaKey: 'pricing.startFreeTrial' as const,
    href: '/register?plan=pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199,
    highlight: false,
    ctaKey: 'pricing.contactSales' as const,
    href: 'mailto:sales@gensmart.co',
  },
];

type FeatureValue = string | boolean | null;

interface FeatureGroup {
  groupKey: string;
  rows: {
    label: string;
    values: [FeatureValue, FeatureValue, FeatureValue, FeatureValue];
  }[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    groupKey: 'core',
    rows: [
      { label: 'AI Agents', values: ['1', '3', '10', 'Unlimited'] },
      { label: 'Messages / month', values: ['50', '1,000', '5,000', '25,000'] },
      { label: 'Contacts', values: ['25', '500', '2,000', 'Unlimited'] },
      { label: 'Support', values: ['Community', 'Email', 'Priority', 'Dedicated'] },
    ],
  },
  {
    groupKey: 'channels',
    rows: [
      { label: 'Web widget', values: [true, true, true, true] },
      { label: 'WhatsApp Business', values: [false, true, true, true] },
    ],
  },
  {
    groupKey: 'ai',
    rows: [
      { label: 'LLM Models', values: ['GPT-4o-mini', 'GPT-4o-mini + Haiku', 'All models', 'All models'] },
      { label: 'Context window', values: ['10 msgs', '15 msgs', '25 msgs', '50 msgs'] },
      { label: 'Max tokens / response', values: ['512', '1,024', '2,048', '4,096'] },
      { label: 'BYO API Key', values: [false, false, false, true] },
    ],
  },
  {
    groupKey: 'crmAdvanced',
    rows: [
      { label: 'Knowledge base files', values: ['1', '5', '20', 'Unlimited'] },
      { label: 'Custom functions', values: [false, '2', '10', 'Unlimited'] },
      { label: 'MCP servers', values: [false, false, '3', 'Unlimited'] },
      { label: 'Sub-accounts', values: [false, false, '5', 'Unlimited'] },
      { label: 'Human takeover', values: [false, true, true, true] },
    ],
  },
];

const ADD_ONS = [
  { messages: '500 messages', price: '$10' },
  { messages: '2,000 messages', price: '$30' },
  { messages: '5,000 messages', price: '$60' },
];

function CellValue({ value }: { value: FeatureValue }) {
  if (value === true)
    return (
      <span className={styles.checkCell} aria-label="Included">
        <Check size={16} />
      </span>
    );
  if (value === false || value === null)
    return (
      <span className={styles.dashCell} aria-label="Not included">
        <Minus size={14} />
      </span>
    );
  return <span className={styles.textCell}>{value}</span>;
}

export default function PricingPage() {
  const { t } = useTranslation();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  function getDisplayPrice(monthly: number) {
    if (monthly === 0) return { price: '0', note: t('pricing.foreverFree') };
    if (cycle === 'quarterly') {
      const d = Math.round(monthly * 0.9);
      return { price: String(d), note: `$${d * 3} ${t('pricing.billedQuarterly')}` };
    }
    if (cycle === 'yearly') {
      const d = Math.round(monthly * 0.8);
      return { price: String(d), note: `$${d * 12} ${t('pricing.billedYearly')}` };
    }
    return { price: String(monthly), note: t('pricing.billedMonthly') };
  }

  const FAQ_ITEMS = [
    { q: t('pricing.faqSection.q1'), a: t('pricing.faqSection.a1') },
    { q: t('pricing.faqSection.q2'), a: t('pricing.faqSection.a2') },
    { q: t('pricing.faqSection.q3'), a: t('pricing.faqSection.a3') },
    { q: t('pricing.faqSection.q4'), a: t('pricing.faqSection.a4') },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <section className={styles.header} aria-label="Pricing header">
        <div className={styles.headerInner}>
          <h1 className={styles.pageTitle}>{t('pricing.pageTitle')}</h1>
          <p className={styles.pageSubtitle}>{t('pricing.pageSubtitle')}</p>

          <div className={styles.toggleGroup} role="group" aria-label="Billing cycle">
            {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map((c) => (
              <button
                key={c}
                className={`${styles.toggleBtn} ${cycle === c ? styles.active : ''}`}
                onClick={() => setCycle(c)}
                aria-pressed={cycle === c}
              >
                {t(`landing.pricing.${c}`)}
                {c === 'quarterly' && (
                  <span className={styles.discountBadge}>{t('pricing.save10')}</span>
                )}
                {c === 'yearly' && (
                  <span className={styles.discountBadge}>{t('pricing.save20')}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className={styles.plansSection} aria-label="Pricing plans">
        <div className={styles.inner}>
          <div className={styles.plansGrid}>
            {PLANS.map(({ id, name, monthlyPrice, highlight, ctaKey, href }) => {
              const { price, note } = getDisplayPrice(monthlyPrice);
              return (
                <div
                  key={id}
                  className={`${styles.planCard} ${highlight ? styles.planHighlight : ''}`}
                >
                  {highlight && (
                    <div className={styles.popularTag}>{t('pricing.mostPopular')}</div>
                  )}
                  <h2 className={styles.planName}>{name}</h2>
                  <div className={styles.priceRow}>
                    <span className={styles.priceCurrency}>$</span>
                    <span className={styles.priceAmount}>{price}</span>
                    <span className={styles.pricePeriod}>{t('pricing.perMonth')}</span>
                  </div>
                  <p className={styles.priceNote}>{note}</p>
                  <Link
                    href={href}
                    className={highlight ? styles.ctaPrimary : styles.ctaOutline}
                  >
                    {t(ctaKey)}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className={styles.tableSection} aria-label="Feature comparison">
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>{t('pricing.compareAll')}</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Feature comparison table">
              <thead>
                <tr>
                  <th className={styles.thFeature}>{t('pricing.feature')}</th>
                  {PLANS.map((p) => (
                    <th
                      key={p.id}
                      className={`${styles.thPlan} ${p.highlight ? styles.thHighlight : ''}`}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_GROUPS.map((group) => (
                  <React.Fragment key={group.groupKey}>
                    <tr className={styles.groupRow}>
                      <td colSpan={5} className={styles.groupLabel}>
                        {t(`pricing.groups.${group.groupKey}`)}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.label} className={styles.featureRow}>
                        <td className={styles.featureLabel}>{row.label}</td>
                        {row.values.map((v, i) => (
                          <td
                            key={i}
                            className={`${styles.featureCell} ${PLANS[i]!.highlight ? styles.cellHighlight : ''}`}
                          >
                            <CellValue value={v} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className={styles.addonsSection} aria-label="Message add-ons">
        <div className={styles.inner}>
          <h2 className={styles.sectionTitle}>{t('pricing.addons.title')}</h2>
          <p className={styles.sectionSubtitle}>{t('pricing.addons.subtitle')}</p>
          <div className={styles.addonsGrid}>
            {ADD_ONS.map((addon) => (
              <div key={addon.messages} className={styles.addonCard}>
                <span className={styles.addonMessages}>{addon.messages}</span>
                <span className={styles.addonPrice}>{addon.price}</span>
                <span className={styles.addonPeriod}>{t('pricing.addons.oneTime')}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className={styles.faqSection} aria-label="Pricing FAQ">
        <div className={styles.faqInner}>
          <h2 className={styles.sectionTitle}>{t('pricing.faqSection.title')}</h2>
          <div className={styles.faqList}>
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className={`${styles.faqItem} ${faqOpen === i ? styles.faqOpen : ''}`}
              >
                <button
                  className={styles.faqQuestion}
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  aria-expanded={faqOpen === i}
                >
                  {item.q}
                  <span className={styles.faqChevron} aria-hidden="true">
                    {faqOpen === i ? '−' : '+'}
                  </span>
                </button>
                <div className={styles.faqAnswerWrap} aria-hidden={faqOpen !== i}>
                  <p className={styles.faqAnswer}>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
