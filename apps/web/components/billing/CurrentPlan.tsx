'use client';

import React from 'react';
import { CreditCard, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
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
  starter: { month: '$29/mo', year: '$278/yr', quarter: '$78/qtr' },
  pro: { month: '$79/mo', year: '$758/yr', quarter: '$213/qtr' },
  enterprise: { month: '$199/mo', year: '$1,910/yr', quarter: '$537/qtr' },
};

function getPlanBadgeClass(plan: string): string {
  switch (plan) {
    case 'starter': return styles.badgeStarter;
    case 'pro': return styles.badgePro;
    case 'enterprise': return styles.badgeEnterprise;
    default: return styles.badgeFree;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusIcon(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) return <AlertCircle size={14} className={styles.statusCanceling} />;
  if (status === 'active') return <CheckCircle2 size={14} className={styles.statusActive} />;
  if (status === 'past_due') return <AlertCircle size={14} className={styles.statusPastDue} />;
  return null;
}

function getStatusText(status: string, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) return 'Cancels at period end';
  switch (status) {
    case 'active': return 'Active';
    case 'past_due': return 'Payment past due';
    case 'canceled': return 'Canceled';
    case 'trialing': return 'Trial';
    default: return status;
  }
}

export default function CurrentPlan({ subscription, loading, onManage, onChangePlan, isManaging }: Props) {
  const plan = subscription?.plan ?? 'free';
  const isFree = plan === 'free';

  const priceStr = !isFree && subscription?.interval
    ? PLAN_PRICES[plan]?.[subscription.interval] ?? ''
    : '';

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
            {isFree ? 'Free Forever' : plan}
          </span>
        </div>

        <div className={styles.actions}>
          {!isFree && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onManage}
              loading={isManaging}
            >
              Manage Subscription
            </Button>
          )}
          <Button
            variant={isFree ? 'primary' : 'secondary'}
            size="sm"
            onClick={onChangePlan}
          >
            {isFree ? 'Upgrade Plan' : 'Change Plan'}
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
          {subscription?.currentPeriodEnd && !isFree && (
            <div className={styles.metaRow}>
              <Calendar size={13} className={subscription.cancelAtPeriodEnd ? styles.cancelsDate : undefined} />
              <span className={subscription.cancelAtPeriodEnd ? styles.cancelsDate : undefined}>
                {subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
          )}
          {!isFree && subscription && (
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
          {isFree && (
            <div className={styles.metaRow}>
              <CheckCircle2 size={13} className={styles.statusFree} />
              <span>Free forever, no credit card required</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
