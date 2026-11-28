'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { TRIAL_DEFERRED_CHARGE_MIN_HOURS } from '@gensmart/shared';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDate } from '@/lib/formatters';
import styles from './PlanUpgradeModal.module.css';

type PlanName = 'solo' | 'starter' | 'pro' | 'enterprise';
type Interval = 'monthly' | 'quarterly' | 'yearly';

interface Props {
  currentPlan: string;
  /** Plan preselected when the modal opens (e.g. "Pay the plan" during the trial). */
  initialPlan?: PlanName | null;
  /** True once the org has a Stripe subscription; until then the current plan can be paid. */
  hasSubscription: boolean;
  /** GenSmart trial end shown to the client (null when not on trial). */
  trialEndsAt: string | null;
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
    key: 'solo',
    name: 'Solo',
    prices: { monthly: '$20', quarterly: '$54.00', yearly: '$192.00' },
    monthlyEquiv: { monthly: '$20/mo', quarterly: '$18.00/mo', yearly: '$16.00/mo' },
    features: [
      '1 agent',
      '200 messages/month',
      'Unlimited contacts',
      'Web + WhatsApp',
      '1 knowledge file',
      'Community support',
    ],
  },
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

export default function PlanUpgradeModal({ currentPlan, initialPlan = null, hasSubscription, trialEndsAt, onClose, onSelect, loading }: Props) {
  const { t, language } = useTranslation();
  const [interval, setInterval] = useState<Interval>('monthly');
  const [selected, setSelected] = useState<PlanName | null>(initialPlan);
  const [openedAt] = useState(() => Date.now());

  // Same 48 h rule as the API (checkoutTrialEnd): first charge deferred to the trial end, or today.
  const deferredChargeAt = (() => {
    if (hasSubscription || !trialEndsAt) return null;
    const end = new Date(trialEndsAt);
    if (isNaN(end.getTime())) return null;
    return end.getTime() - openedAt >= TRIAL_DEFERRED_CHARGE_MIN_HOURS * 60 * 60 * 1000 ? end : null;
  })();

  const SAVINGS: Record<Interval, string | null> = {
    monthly: null,
    quarterly: t('landing.pricing.save10'),
    yearly: t('landing.pricing.save20'),
  };

  function handleSelect(plan: PlanName) {
    if (plan === currentPlan && hasSubscription) return;
    setSelected(plan);
  }

  function handleUpgrade() {
    if (!selected) return;
    onSelect(selected, interval);
  }

  const intervalLabel = (i: Interval) => {
    switch (i) {
      case 'monthly': return t('landing.pricing.monthly');
      case 'quarterly': return t('landing.pricing.quarterly');
      case 'yearly': return t('landing.pricing.yearly');
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2>{t('billing.upgrade.title')}</h2>
            <p>{t('billing.upgrade.choosePlan')}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
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
              {intervalLabel(i)}
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
                  isCurrent && hasSubscription ? styles.planCardCurrent : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleSelect(plan.key)}
              >
                {plan.popular && <span className={styles.popularBadge}>{t('billing.upgrade.popular')}</span>}
                {isCurrent && <span className={styles.popularBadge} style={{ background: '#9ca3af' }}>{t('billing.upgrade.current')}</span>}
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
              ? t(hasSubscription ? 'billing.upgrade.upgradeTo' : 'billing.upgrade.payPlan', { plan: selected.charAt(0).toUpperCase() + selected.slice(1) })
              : t('billing.upgrade.selectPlan')}
          </Button>
          {!hasSubscription && selected && (
            <div className={styles.currentLabel}>
              {deferredChargeAt
                ? t('billing.upgrade.deferredCharge', { date: formatDate(deferredChargeAt, language) })
                : t('billing.upgrade.chargedToday')}
            </div>
          )}
          <div className={styles.currentLabel}>
            {t('billing.upgrade.currentlyOn', { plan: currentPlan })}
          </div>
        </div>
      </div>
    </div>
  );
}
