'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import styles from './PlanUpgradeModal.module.css';

type PlanName = 'starter' | 'pro' | 'enterprise';
type Interval = 'monthly' | 'quarterly' | 'yearly';

interface Props {
  currentPlan: string;
  onClose: () => void;
  onSelect: (plan: PlanName, interval: Interval) => void;
  loading: boolean;
}

const PLANS: Array<{
  key: PlanName;
  name: string;
  popular?: boolean;
  prices: Record<Interval, string>;
  monthlyEquiv: Record<Interval, string>;
  features: string[];
}> = [
  {
    key: 'starter',
    name: 'Starter',
    prices: { monthly: '$29', quarterly: '$78.30', yearly: '$278.40' },
    monthlyEquiv: { monthly: '$29/mo', quarterly: '$26.10/mo', yearly: '$23.20/mo' },
    features: [
      '3 agents',
      '1,000 messages/month',
      '500 contacts',
      'Web + WhatsApp',
      '5 knowledge files',
      'Human takeover',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    popular: true,
    prices: { monthly: '$79', quarterly: '$213.30', yearly: '$758.40' },
    monthlyEquiv: { monthly: '$79/mo', quarterly: '$71.10/mo', yearly: '$63.20/mo' },
    features: [
      '10 agents',
      '5,000 messages/month',
      '2,000 contacts',
      '10 custom functions',
      '3 MCP servers',
      '5 sub-accounts',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    prices: { monthly: '$199', quarterly: '$537.30', yearly: '$1,910.40' },
    monthlyEquiv: { monthly: '$199/mo', quarterly: '$179.10/mo', yearly: '$159.20/mo' },
    features: [
      'Unlimited agents',
      '25,000 messages/month',
      'Unlimited contacts',
      'Unlimited functions',
      'BYO API Key',
      'Dedicated support',
    ],
  },
];

const SAVINGS: Record<Interval, string | null> = {
  monthly: null,
  quarterly: 'Save 10%',
  yearly: 'Save 20%',
};

export default function PlanUpgradeModal({ currentPlan, onClose, onSelect, loading }: Props) {
  const [interval, setInterval] = useState<Interval>('monthly');
  const [selected, setSelected] = useState<PlanName | null>(null);

  function handleSelect(plan: PlanName) {
    if (plan === currentPlan) return;
    setSelected(plan);
  }

  function handleUpgrade() {
    if (!selected) return;
    onSelect(selected, interval);
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2>Upgrade Your Plan</h2>
            <p>Choose the plan that fits your needs. Cancel anytime.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.intervalToggle}>
          {(['monthly', 'quarterly', 'yearly'] as Interval[]).map((i) => (
            <button
              key={i}
              className={`${styles.toggleBtn} ${interval === i ? styles.toggleBtnActive : ''}`}
              onClick={() => setInterval(i)}
            >
              {i.charAt(0).toUpperCase() + i.slice(1)}
            </button>
          ))}
          {SAVINGS[interval] && (
            <span className={styles.savingBadge}>{SAVINGS[interval]}</span>
          )}
        </div>

        <div className={styles.plans}>
          {PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const isSelected = selected === plan.key;
            return (
              <div
                key={plan.key}
                className={[
                  styles.planCard,
                  isSelected ? styles.planCardSelected : '',
                  isCurrent ? styles.planCardCurrent : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleSelect(plan.key)}
              >
                {plan.popular && <span className={styles.popularBadge}>Popular</span>}
                {isCurrent && <span className={styles.popularBadge} style={{ background: '#9ca3af' }}>Current</span>}
                <div className={styles.planCardName}>{plan.name}</div>
                <div>
                  <div className={styles.planCardPrice}>{plan.prices[interval]}</div>
                  <div className={styles.planCardPricePer}>{plan.monthlyEquiv[interval]}</div>
                </div>
                <ul className={styles.planCardFeatures}>
                  {plan.features.map((f) => (
                    <li key={f} className={styles.planCardFeature}>
                      <Check size={12} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <Button
            variant="primary"
            onClick={handleUpgrade}
            loading={loading}
            disabled={!selected}
            style={{ minWidth: '200px' }}
          >
            {selected
              ? `Upgrade to ${selected.charAt(0).toUpperCase() + selected.slice(1)}`
              : 'Select a Plan'}
          </Button>
          <div className={styles.currentLabel}>
            Currently on <strong>{currentPlan}</strong> plan · Powered by Stripe
          </div>
        </div>
      </div>
    </div>
  );
}
