'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import styles from './pricing.module.css';

// Note: metadata can't be exported from 'use client' files in Next.js.
// For SEO on this page, metadata is set via generateMetadata in a server wrapper.
// Since this whole page needs the toggle (client state), we put metadata in layout or a parent server component.

type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    highlight: false,
    cta: 'Get Started',
    href: '/register',
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    highlight: false,
    cta: 'Start Free Trial',
    href: '/register?plan=starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 79,
    highlight: true,
    cta: 'Start Free Trial',
    href: '/register?plan=pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199,
    highlight: false,
    cta: 'Contact Sales',
    href: 'mailto:sales@gensmart.ai',
  },
];

function getDisplayPrice(monthly: number, cycle: BillingCycle) {
  if (monthly === 0) return { price: '0', note: 'Forever free' };
  if (cycle === 'quarterly') {
    const monthly_discounted = Math.round(monthly * 0.9);
    return { price: String(monthly_discounted), note: `$${monthly_discounted * 3} billed quarterly` };
  }
  if (cycle === 'yearly') {
    const monthly_discounted = Math.round(monthly * 0.8);
    return { price: String(monthly_discounted), note: `$${monthly_discounted * 12} billed yearly` };
  }
  return { price: String(monthly), note: 'Billed monthly' };
}

type FeatureValue = string | boolean | null;

interface FeatureGroup {
  groupTitle: string;
  rows: {
    label: string;
    values: [FeatureValue, FeatureValue, FeatureValue, FeatureValue];
  }[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    groupTitle: 'Core',
    rows: [
      { label: 'AI Agents', values: ['1', '3', '10', 'Unlimited'] },
      { label: 'Messages / month', values: ['50', '1,000', '5,000', '25,000'] },
      { label: 'Contacts', values: ['25', '500', '2,000', 'Unlimited'] },
      { label: 'Support', values: ['Community', 'Email', 'Priority', 'Dedicated'] },
    ],
  },
  {
    groupTitle: 'Channels',
    rows: [
      { label: 'Web widget', values: [true, true, true, true] },
      { label: 'WhatsApp Business', values: [false, true, true, true] },
    ],
  },
  {
    groupTitle: 'AI',
    rows: [
      { label: 'LLM Models', values: ['GPT-4o-mini', 'GPT-4o-mini + Haiku', 'All models', 'All models'] },
      { label: 'Context window', values: ['10 msgs', '15 msgs', '25 msgs', '50 msgs'] },
      { label: 'Max tokens / response', values: ['512', '1,024', '2,048', '4,096'] },
      { label: 'BYO API Key', values: [false, false, false, true] },
    ],
  },
  {
    groupTitle: 'CRM & Advanced',
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
  { messages: '500 messages', price: '$10', period: 'one-time' },
  { messages: '2,000 messages', price: '$30', period: 'one-time' },
  { messages: '5,000 messages', price: '$60', period: 'one-time' },
];

const PRICING_FAQ = [
  {
    q: 'Can I change plans anytime?',
    a: 'Yes, you can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the next billing cycle.',
  },
  {
    q: 'What happens when I hit my message limit?',
    a: "Your agents pause automatically. We'll notify you at 80% so you can upgrade or purchase add-on messages before hitting the limit.",
  },
  {
    q: 'Do unused messages roll over?',
    a: 'No, message limits reset on the 1st of each month. Add-on message packs are non-cumulative and expire at month end.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards (Visa, Mastercard, American Express) via Stripe. Enterprise plans can also be paid by invoice.',
  },
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
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <div className={styles.page}>
      {/* Header */}
      <section className={styles.header} aria-label="Pricing header">
        <div className={styles.headerInner}>
          <h1 className={styles.pageTitle}>Simple, Transparent Pricing</h1>
          <p className={styles.pageSubtitle}>
            Start free. Upgrade when you&apos;re ready. No hidden fees.
          </p>

          <div className={styles.toggleGroup} role="group" aria-label="Billing cycle">
            {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map((c) => (
              <button
                key={c}
                className={`${styles.toggleBtn} ${cycle === c ? styles.active : ''}`}
                onClick={() => setCycle(c)}
                aria-pressed={cycle === c}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
                {c === 'quarterly' && (
                  <span className={styles.discountBadge}>10% off</span>
                )}
                {c === 'yearly' && (
                  <span className={styles.discountBadge}>20% off</span>
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
            {PLANS.map(({ id, name, monthlyPrice, highlight, cta, href }) => {
              const { price, note } = getDisplayPrice(monthlyPrice, cycle);
              return (
                <div
                  key={id}
                  className={`${styles.planCard} ${highlight ? styles.planHighlight : ''}`}
                >
                  {highlight && (
                    <div className={styles.popularTag}>Most Popular</div>
                  )}
                  <h2 className={styles.planName}>{name}</h2>
                  <div className={styles.priceRow}>
                    <span className={styles.priceCurrency}>$</span>
                    <span className={styles.priceAmount}>{price}</span>
                    <span className={styles.pricePeriod}>/mo</span>
                  </div>
                  <p className={styles.priceNote}>{note}</p>
                  <Link
                    href={href}
                    className={highlight ? styles.ctaPrimary : styles.ctaOutline}
                  >
                    {cta}
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
          <h2 className={styles.sectionTitle}>Compare All Features</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Feature comparison table">
              <thead>
                <tr>
                  <th className={styles.thFeature}>Feature</th>
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
                  <React.Fragment key={group.groupTitle}>
                    <tr className={styles.groupRow}>
                      <td colSpan={5} className={styles.groupLabel}>
                        {group.groupTitle}
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
          <h2 className={styles.sectionTitle}>Need More Messages?</h2>
          <p className={styles.sectionSubtitle}>
            Purchase one-time message packs when you need them. Non-cumulative, expires at month end.
          </p>
          <div className={styles.addonsGrid}>
            {ADD_ONS.map((addon) => (
              <div key={addon.messages} className={styles.addonCard}>
                <span className={styles.addonMessages}>{addon.messages}</span>
                <span className={styles.addonPrice}>{addon.price}</span>
                <span className={styles.addonPeriod}>{addon.period}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
      <section className={styles.faqSection} aria-label="Pricing FAQ">
        <div className={styles.faqInner}>
          <h2 className={styles.sectionTitle}>Common Questions</h2>
          <div className={styles.faqList}>
            {PRICING_FAQ.map((item, i) => (
              <div
                key={item.q}
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
