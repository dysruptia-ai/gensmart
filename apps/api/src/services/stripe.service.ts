import Stripe from 'stripe';
import { stripe } from '../config/stripe';
import { env } from '../config/env';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { getIO } from '../config/websocket';

// ── Price ID resolution ───────────────────────────────────────────────────────

type PlanName = 'starter' | 'pro' | 'enterprise';
type Interval = 'monthly' | 'quarterly' | 'yearly';
type AddonKey = 'messages_500' | 'messages_2000' | 'messages_5000';

function getPriceId(plan: PlanName, interval: Interval): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}` as keyof typeof env;
  return (env[key] as string) ?? '';
}

function getAddonPriceId(addon: AddonKey): string {
  const map: Record<AddonKey, string> = {
    messages_500: env.STRIPE_PRICE_ADDON_500,
    messages_2000: env.STRIPE_PRICE_ADDON_2000,
    messages_5000: env.STRIPE_PRICE_ADDON_5000,
  };
  return map[addon] ?? '';
}

// ── Customer management ───────────────────────────────────────────────────────

export async function createCustomer(
  orgId: string,
  email: string,
  name: string
): Promise<Stripe.Customer> {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { orgId },
  });

  await query(
    'UPDATE organizations SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
    [customer.id, orgId]
  );

  return customer;
}

export async function getOrCreateCustomer(
  orgId: string,
  email: string,
  name: string
): Promise<string> {
  const result = await query<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM organizations WHERE id = $1',
    [orgId]
  );
  const existing = result.rows[0]?.stripe_customer_id;
  if (existing) return existing;

  const customer = await createCustomer(orgId, email, name);
  return customer.id;
}

export async function updateCustomerEmail(
  customerId: string,
  email: string
): Promise<void> {
  await stripe.customers.update(customerId, { email });
}

// ── Checkout & portal ─────────────────────────────────────────────────────────

export async function createCheckoutSession(params: {
  orgId: string;
  customerId: string;
  priceId: string;
  plan: PlanName;
  interval: Interval;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    metadata: {
      orgId: params.orgId,
      plan: params.plan,
      interval: params.interval,
      type: 'subscription',
    },
    subscription_data: {
      metadata: {
        orgId: params.orgId,
        plan: params.plan,
        interval: params.interval,
      },
    },
  });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// ── Subscription management ───────────────────────────────────────────────────

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

// ── Add-on payments ───────────────────────────────────────────────────────────

export async function createAddOnCheckout(params: {
  customerId: string;
  addon: AddonKey;
  orgId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const priceId = getAddonPriceId(params.addon);
  if (!priceId || priceId === 'price_placeholder') {
    throw new Error(
      'Add-on price ID not configured. Run: npm run stripe:seed --workspace=apps/api'
    );
  }

  const addonMessages: Record<AddonKey, number> = {
    messages_500: 500,
    messages_2000: 2000,
    messages_5000: 5000,
  };

  return stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      orgId: params.orgId,
      type: 'addon',
      addon: params.addon,
      messageCount: String(addonMessages[params.addon]),
    },
  });
}

// ── Invoice history ───────────────────────────────────────────────────────────

export async function getInvoices(
  customerId: string,
  limit = 20
): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
    expand: ['data.subscription'],
  });
  return invoices.data;
}

// ── Price resolution (for frontend) ──────────────────────────────────────────

export function getPricesForPlan(plan: PlanName): {
  monthly: string;
  quarterly: string;
  yearly: string;
} {
  return {
    monthly: getPriceId(plan, 'monthly'),
    quarterly: getPriceId(plan, 'quarterly'),
    yearly: getPriceId(plan, 'yearly'),
  };
}

export function getAddonPrices(): {
  messages_500: string;
  messages_2000: string;
  messages_5000: string;
} {
  return {
    messages_500: env.STRIPE_PRICE_ADDON_500,
    messages_2000: env.STRIPE_PRICE_ADDON_2000,
    messages_5000: env.STRIPE_PRICE_ADDON_5000,
  };
}

// ── Webhook helpers ───────────────────────────────────────────────────────────

export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
}

export async function saveBillingEvent(
  orgId: string,
  stripeEventId: string,
  eventType: string,
  amount: number | null,
  metadata: Record<string, unknown>
): Promise<boolean> {
  try {
    await query(
      `INSERT INTO billing_events (organization_id, stripe_event_id, event_type, amount, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (stripe_event_id) DO NOTHING`,
      [orgId, stripeEventId, eventType, amount, JSON.stringify(metadata)]
    );
    return true;
  } catch {
    return false;
  }
}

export async function updateOrgSubscription(params: {
  orgId: string;
  plan: string;
  subscriptionId: string;
  status: string;
  periodStart: Date | null;
  periodEnd: Date | null;
}): Promise<void> {
  await query(
    `UPDATE organizations
     SET plan = $1,
         stripe_subscription_id = $2,
         subscription_status = $3,
         current_period_start = $4,
         current_period_end = $5,
         updated_at = NOW()
     WHERE id = $6`,
    [
      params.plan,
      params.subscriptionId,
      params.status,
      params.periodStart?.toISOString() ?? null,
      params.periodEnd?.toISOString() ?? null,
      params.orgId,
    ]
  );
}

export async function downgradeOrgToFree(orgId: string): Promise<void> {
  await query(
    `UPDATE organizations
     SET plan = 'free',
         stripe_subscription_id = NULL,
         subscription_status = 'canceled',
         current_period_start = NULL,
         current_period_end = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [orgId]
  );
}

// ── Webhook event processing ──────────────────────────────────────────────────

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  // Idempotency: skip events already recorded
  const existing = await query<{ id: string }>(
    'SELECT id FROM billing_events WHERE stripe_event_id = $1',
    [event.id]
  );
  if (existing.rows.length > 0) {
    console.log(`[webhook] Event ${event.id} already processed, skipping`);
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.['orgId'];
      const type = session.metadata?.['type'];
      if (!orgId) return;

      if (type === 'addon') {
        const addonStr = session.metadata?.['addon'];
        const messageCount = parseInt(session.metadata?.['messageCount'] ?? '0', 10);
        if (addonStr && messageCount > 0) {
          const now = new Date();
          const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const addonKey = `usage:${orgId}:${yearMonth}:addon_messages`;
          await redis.incrby(addonKey, messageCount);
          await redis.expire(addonKey, 45 * 24 * 60 * 60);
          console.log(`[webhook] Added ${messageCount} addon messages for org ${orgId}`);
          try { getIO().to(`org:${orgId}`).emit('billing:addon_applied', { addon: addonStr, messageCount }); } catch { /* ignore */ }
        }
        await saveBillingEvent(orgId, event.id, event.type, session.amount_total,
          { addon: addonStr, sessionId: session.id });
        return;
      }

      if (type === 'subscription') {
        const plan = session.metadata?.['plan'] ?? 'starter';
        const interval = session.metadata?.['interval'] ?? 'monthly';
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        if (subscriptionId) {
          try {
            const sub = await getSubscription(subscriptionId);
            const item = sub.items.data[0];
            const periodStartTs = item?.current_period_start ?? sub.billing_cycle_anchor;
            const periodEndTs = item?.current_period_end;
            await updateOrgSubscription({
              orgId, plan, subscriptionId,
              status: sub.status,
              periodStart: new Date(periodStartTs * 1000),
              periodEnd: periodEndTs ? new Date(periodEndTs * 1000) : null,
            });
            console.log(`[webhook] Subscription created: org=${orgId} plan=${plan}`);
            try { getIO().to(`org:${orgId}`).emit('billing:subscription_updated', { plan, status: sub.status }); } catch { /* ignore */ }
          } catch (err) {
            console.error('[webhook] Error fetching subscription:', err);
          }
        }
        await saveBillingEvent(orgId, event.id, event.type, session.amount_total,
          { plan, interval, sessionId: session.id });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.['orgId'];
      if (!orgId) return;
      const plan = sub.metadata?.['plan'] ?? 'starter';
      const item = sub.items.data[0];
      const periodStartTs = item?.current_period_start ?? sub.billing_cycle_anchor;
      const periodEndTs = item?.current_period_end;
      await updateOrgSubscription({
        orgId, plan, subscriptionId: sub.id, status: sub.status,
        periodStart: new Date(periodStartTs * 1000),
        periodEnd: periodEndTs ? new Date(periodEndTs * 1000) : null,
      });
      await saveBillingEvent(orgId, event.id, event.type, null, { plan, status: sub.status });
      try { getIO().to(`org:${orgId}`).emit('billing:subscription_updated', { plan, status: sub.status }); } catch { /* ignore */ }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.['orgId'];
      if (!orgId) return;
      await downgradeOrgToFree(orgId);
      await saveBillingEvent(orgId, event.id, event.type, null, { reason: 'subscription_deleted' });
      console.log(`[webhook] Subscription deleted — org ${orgId} downgraded to free`);
      try { getIO().to(`org:${orgId}`).emit('billing:subscription_updated', { plan: 'free', status: 'canceled' }); } catch { /* ignore */ }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const orgResult = await query<{ id: string }>(
        'SELECT id FROM organizations WHERE stripe_customer_id = $1', [customerId]
      );
      const orgId = orgResult.rows[0]?.id;
      if (!orgId) return;
      await saveBillingEvent(orgId, event.id, event.type, invoice.amount_paid,
        { invoiceId: invoice.id, invoiceNumber: invoice.number });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const orgResult = await query<{ id: string }>(
        'SELECT id FROM organizations WHERE stripe_customer_id = $1', [customerId]
      );
      const orgId = orgResult.rows[0]?.id;
      if (!orgId) return;
      await query(
        'UPDATE organizations SET subscription_status = $1, updated_at = NOW() WHERE id = $2',
        ['past_due', orgId]
      );
      await saveBillingEvent(orgId, event.id, event.type, invoice.amount_due, { invoiceId: invoice.id });
      try { getIO().to(`org:${orgId}`).emit('billing:payment_failed', { message: 'Your payment failed. Please update your payment method.' }); } catch { /* ignore */ }
      break;
    }

    default:
      console.log(`[webhook] Unhandled event type: ${event.type}`);
  }
}
