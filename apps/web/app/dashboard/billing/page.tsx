'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
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
}

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

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [addonLoading, setAddonLoading] = useState<'messages_500' | 'messages_2000' | 'messages_5000' | null>(null);

  const loadData = useCallback(async () => {
    // Load all data in parallel
    const [subResult, usageResult, invoicesResult] = await Promise.allSettled([
      api.get<SubscriptionData>('/api/billing/subscription'),
      api.get<UsageData>('/api/billing/usage'),
      api.get<{ invoices: Invoice[] }>('/api/billing/invoices'),
    ]);

    if (subResult.status === 'fulfilled') {
      setSubscription(subResult.value);
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
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Check for success/cancelled query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      success('Subscription activated! Welcome to your new plan.');
      window.history.replaceState({}, '', '/dashboard/billing');
      void loadData();
    } else if (params.get('addon_success') === '1') {
      success('Add-on messages purchased successfully!');
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
      toastError(err instanceof ApiError ? err.message : 'Failed to open billing portal');
    } finally {
      setIsManaging(false);
    }
  }

  async function handleUpgrade(plan: 'starter' | 'pro' | 'enterprise', interval: 'monthly' | 'quarterly' | 'yearly') {
    setUpgradeLoading(true);
    try {
      const result = await api.post<{ url?: string; success?: boolean }>('/api/billing/create-checkout', { plan, interval });
      if (result.success) {
        // Direct subscription update (existing subscriber)
        success('Plan updated successfully!');
        setShowUpgradeModal(false);
        void loadData();
      } else if (result.url) {
        // New subscription via Stripe Checkout
        window.location.href = result.url;
      }
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to start checkout');
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
      toastError(err instanceof ApiError ? err.message : 'Failed to start checkout');
      setAddonLoading(null);
    }
  }

  const currentPlan = subscription?.plan ?? 'free';

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
          onChangePlan={() => setShowUpgradeModal(true)}
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
          onClose={() => setShowUpgradeModal(false)}
          onSelect={handleUpgrade}
          loading={upgradeLoading}
        />
      )}
    </div>
  );
}
