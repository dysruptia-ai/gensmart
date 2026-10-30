'use client';

import React from 'react';
import { CreditCard, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDate } from '@/lib/formatters';
import styles from './CurrentPlan.module.css';

interface SubscriptionData {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  interval: string | null;
}

interface Props {
  subscription: SubscriptionData | null;
  loading: boolean;
  onManage: () => void;
  onChangePlan: () => void;
  isManaging: boolean;
}

const PLAN_PRICES: Record<string, Record<string, string>> = {
  solo: { month: '$20/mo', year: '$192/yr', quarter: '$54/qtr' },
  starter: { month: '$29/mo', year: '$278/yr', quarter: '$78/qtr' },
  pro: { month: '$79/mo', year: '$758/yr', quarter: '$213/qtr' },
  enterprise: { month: '$199/mo', year: '$1,910/yr', quarter: '$537/qtr' },
};

function getPlanBadgeClass(plan: string): string {
  switch (plan) {
    case 'solo': return styles.badgeStarter;
    case 'starter': return styles.badgeStarter;
    case 'pro': return styles.badgePro;
    case 'enterprise': return styles.badgeEnterprise;
    default: return styles.badgeStarter;
  }
}

function getStatusIcon(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) return <AlertCircle size={14} className={styles.statusCanceling} />;
  if (status === 'active') return <CheckCircle2 size={14} className={styles.statusActive} />;
  if (status === 'past_due') return <AlertCircle size={14} className={styles.statusPastDue} />;
  return null;
}

export default function CurrentPlan({ subscription, loading, onManage, onChangePlan, isManaging }: Props) {
  const { t, language } = useTranslation();

  const plan = subscription?.plan ?? 'solo';

  const priceStr = subscription?.interval
    ? PLAN_PRICES[plan]?.[subscription.interval] ?? ''
    : '';

  function getStatusText(status: string, cancelAtPeriodEnd: boolean): string {
    if (cancelAtPeriodEnd) return t('billing.currentPlan.cancelsAtPeriodEnd');
    switch (status) {
      case 'active': return t('billing.currentPlan.subscriptionActive');
      case 'past_due': return t('billing.currentPlan.paymentPastDue');
      case 'canceled': return t('billing.currentPlan.subscriptionCancelled');
      case 'trialing': return t('billing.currentPlan.trial');
      default: return status;
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.planInfo}>
          <CreditCard size={20} color="var(--color-primary)" />
          <span className={styles.planName}>
            {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
          </span>
          <span className={getPlanBadgeClass(plan)} style={{
            display: 'inline-block',
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            textTransform: 'capitalize',
          }}>
            {plan}
          </span>
        </div>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onManage}
            loading={isManaging}
          >
            {t('billing.currentPlan.manageSubscription')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onChangePlan}
          >
            {t('billing.currentPlan.changePlan')}
          </Button>
        </div>
      </div>

      {!loading && (
        <div className={styles.meta}>
          {priceStr && (
            <div className={styles.metaRow}>
              <CreditCard size={13} />
              <span>{priceStr}</span>
            </div>
          )}
          {subscription?.currentPeriodEnd && (
            <div className={styles.metaRow}>
              <Calendar size={13} className={subscription.cancelAtPeriodEnd ? styles.cancelsDate : undefined} />
              <span className={subscription.cancelAtPeriodEnd ? styles.cancelsDate : undefined}>
                {subscription.cancelAtPeriodEnd ? t('billing.currentPlan.cancels') : t('billing.currentPlan.renews')} {formatDate(subscription.currentPeriodEnd, language)}
              </span>
            </div>
          )}
          {subscription && (
            <div className={styles.metaRow}>
              {getStatusIcon(subscription.status, subscription.cancelAtPeriodEnd)}
              <span className={
                subscription.cancelAtPeriodEnd ? styles.statusCanceling :
                subscription.status === 'past_due' ? styles.statusPastDue :
                subscription.status === 'active' ? styles.statusActive :
                styles.statusFree
              }>
                {getStatusText(subscription.status, subscription.cancelAtPeriodEnd)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
