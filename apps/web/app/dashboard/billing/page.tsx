'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDate } from '@/lib/formatters';
import { OPEN_PAY_PLAN_EVENT } from '@/lib/billingEvents';
import CurrentPlan from '@/components/billing/CurrentPlan';
import UsageBars from '@/components/billing/UsageBars';
import AddOnCards from '@/components/billing/AddOnCards';
import InvoiceTable from '@/components/billing/InvoiceTable';
import PlanUpgradeModal from '@/components/billing/PlanUpgradeModal';
import styles from './billing.module.css';

interface SubscriptionData {
  plan: string;
  status: string;
  subscriptionId: string | null;
  customerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  interval: string | null;
  trialEndsAt: string | null;
  firstChargeAt: string | null;
}

type PlanName = 'solo' | 'starter' | 'pro' | 'enterprise';
const PLAN_NAMES: readonly PlanName[] = ['solo', 'starter', 'pro', 'enterprise'];
const isPlanName = (p: string | null | undefined): p is PlanName => !!p && (PLAN_NAMES as readonly string[]).includes(p);

interface UsageData {
  messages: { used: number; limit: number | null; percent: number; addonMessages?: number };
  agents: { used: number; limit: number | null; percent: number };
  contacts: { used: number; limit: number | null; percent: number };
  knowledgeFiles: { used: number; limit: number | null; percent: number };
}

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  created: number;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

export default function BillingPage() {
  const { success, error: toastError } = useToast();
  const { t, language } = useTranslation();

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [modalInitialPlan, setModalInitialPlan] = useState<PlanName | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [addonLoading, setAddonLoading] = useState<'messages_500' | 'messages_2000' | 'messages_5000' | null>(null);

  const loadData = useCallback(async (): Promise<SubscriptionData | null> => {
    // Load all data in parallel
    const [subResult, usageResult, invoicesResult] = await Promise.allSettled([
      api.get<SubscriptionData>('/api/billing/subscription'),
      api.get<UsageData>('/api/billing/usage'),
      api.get<{ invoices: Invoice[] }>('/api/billing/invoices'),
    ]);

    const sub = subResult.status === 'fulfilled' ? subResult.value : null;
    if (sub) {
      setSubscription(sub);
    }
    setLoadingSub(false);

    if (usageResult.status === 'fulfilled') {
      setUsage(usageResult.value);
    }
    setLoadingUsage(false);

    if (invoicesResult.status === 'fulfilled') {
      setInvoices(invoicesResult.value.invoices);
    }
    setLoadingInvoices(false);
    return sub;
  }, []);

  function openPlanModal(initialPlan: PlanName | null) {
    setModalInitialPlan(initialPlan);
    setShowUpgradeModal(true);
  }

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Trial banner clicked while already on this page.
  useEffect(() => {
    function onOpenPayPlan() {
      openPlanModal(!subscription?.subscriptionId && isPlanName(subscription?.plan) ? subscription.plan : null);
    }
    window.addEventListener(OPEN_PAY_PLAN_EVENT, onOpenPayPlan);
    return () => window.removeEventListener(OPEN_PAY_PLAN_EVENT, onOpenPayPlan);
  }, [subscription?.plan, subscription?.subscriptionId]);

  // Check for success/cancelled query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      window.history.replaceState({}, '', '/dashboard/billing');
      // The message depends on the reloaded data: deferred first charge (Stripe trial) or paid now.
      void loadData().then((sub) => {
        if (sub?.firstChargeAt) {
          success(t('billing.toast.paidDeferred', { date: formatDate(sub.firstChargeAt, language) }));
        } else {
          success(t('billing.toast.paidNow'));
        }
      });
    } else if (params.get('pay') === '1') {
      // From the dashboard trial banner: open the modal with the current plan selected.
      window.history.replaceState({}, '', '/dashboard/billing');
      void loadData().then((sub) => {
        openPlanModal(!sub?.subscriptionId && isPlanName(sub?.plan) ? sub.plan : null);
      });
    } else if (params.get('addon_success') === '1') {
      success(t('billing.toast.addonPurchased'));
      window.history.replaceState({}, '', '/dashboard/billing');
      void loadData();
    } else if (params.get('cancelled') === '1') {
      window.history.replaceState({}, '', '/dashboard/billing');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManageSubscription() {
    setIsManaging(true);
    try {
      const { url } = await api.post<{ url: string }>('/api/billing/create-portal');
      window.open(url, '_blank');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('billing.toast.portalFailed'));
    } finally {
      setIsManaging(false);
    }
  }

  async function handleUpgrade(plan: PlanName, interval: 'monthly' | 'quarterly' | 'yearly') {
    setUpgradeLoading(true);
    try {
      const result = await api.post<{ url?: string; success?: boolean }>('/api/billing/create-checkout', { plan, interval });
      if (result.success) {
        // Direct subscription update (existing subscriber)
        success(t('billing.toast.planUpdated'));
        setShowUpgradeModal(false);
        void loadData();
      } else if (result.url) {
        // New subscription via Stripe Checkout
        window.location.href = result.url;
      }
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('billing.toast.checkoutFailed'));
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function handleBuyAddon(addon: 'messages_500' | 'messages_2000' | 'messages_5000') {
    setAddonLoading(addon);
    try {
      const { url } = await api.post<{ url: string }>('/api/billing/addon', { addon });
      window.location.href = url;
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('billing.toast.checkoutFailed'));
      setAddonLoading(null);
    }
  }

  const currentPlan = subscription?.plan ?? 'solo';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Billing & Subscription</h1>
        <p className={styles.pageDesc}>Manage your plan, usage, and payment history.</p>
      </div>

      <div className={styles.grid}>
        {/* Current Plan */}
        <CurrentPlan
          subscription={subscription}
          loading={loadingSub}
          onManage={handleManageSubscription}
          onChangePlan={() => openPlanModal(null)}
          onPayPlan={() => openPlanModal(isPlanName(currentPlan) ? currentPlan : null)}
          isManaging={isManaging}
        />

        {/* Usage */}
        <UsageBars
          usage={usage}
          loading={loadingUsage}
          onBuyAddon={() => setShowUpgradeModal(false)}
        />

        {/* Add-ons */}
        <AddOnCards
          onBuy={handleBuyAddon}
          loading={addonLoading}
          plan={currentPlan}
        />

        {/* Invoice History */}
        <InvoiceTable
          invoices={invoices}
          loading={loadingInvoices}
        />
      </div>

      {showUpgradeModal && (
        <PlanUpgradeModal
          currentPlan={currentPlan}
          initialPlan={modalInitialPlan}
          hasSubscription={!!subscription?.subscriptionId}
          trialEndsAt={subscription?.subscriptionId ? null : subscription?.trialEndsAt ?? null}
          onClose={() => setShowUpgradeModal(false)}
          onSelect={handleUpgrade}
          loading={upgradeLoading}
        />
      )}
    </div>
  );
}
