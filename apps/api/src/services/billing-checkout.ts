/**
 * POST /api/billing/create-checkout logic, kept free of config imports so it can be tested with a
 * simulated Stripe client (billing-checkout.test.ts).
 *
 * Paying during the GenSmart trial: the card is saved in Checkout and the subscription starts the
 * same day, but the first charge is deferred to the day the trial ends (subscription_data.trial_end).
 * Stripe requires trial_end ≥ 48 h in the future; with less time left, Checkout charges at once.
 */
import type Stripe from 'stripe';
import { TRIAL_DEFERRED_CHARGE_MIN_HOURS } from '@gensmart/shared';

export type PlanName = 'solo' | 'starter' | 'pro' | 'enterprise';
export type Interval = 'monthly' | 'quarterly' | 'yearly';

/** Unix seconds of trialEndsAt when at least TRIAL_DEFERRED_CHARGE_MIN_HOURS remain; otherwise null. */
export function checkoutTrialEnd(trialEndsAt: Date | null, now: Date): number | null {
  if (!trialEndsAt || isNaN(trialEndsAt.getTime())) return null;
  const minMs = TRIAL_DEFERRED_CHARGE_MIN_HOURS * 60 * 60 * 1000;
  if (trialEndsAt.getTime() - now.getTime() < minMs) return null;
  return Math.floor(trialEndsAt.getTime() / 1000);
}

export function checkoutSessionParams(params: {
  orgId: string;
  customerId: string;
  priceId: string;
  plan: PlanName;
  interval: Interval;
  successUrl: string;
  cancelUrl: string;
  trialEnd?: number | null;
}): Stripe.Checkout.SessionCreateParams {
  return {
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
      ...(params.trialEnd ? { trial_end: params.trialEnd } : {}),
    },
  };
}

/**
 * customer.subscription.updated reads the plan from the subscription metadata, so a plan change
 * must update metadata.plan/interval along with the price.
 */
export function subscriptionPlanUpdateParams(
  itemId: string,
  newPriceId: string,
  plan: PlanName,
  interval: Interval
): Stripe.SubscriptionUpdateParams {
  return {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'create_prorations',
    metadata: { plan, interval },
  };
}

/** The slice of the Stripe client create-checkout uses (real client or a test double). */
export interface CheckoutStripeClient {
  subscriptions: {
    retrieve(id: string): Promise<Stripe.Subscription>;
    update(id: string, params: Stripe.SubscriptionUpdateParams): Promise<Stripe.Subscription>;
  };
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session>;
    };
  };
}

export type CreateCheckoutResult =
  | { kind: 'updated'; subscription: Stripe.Subscription }
  | { kind: 'checkout'; url: string | null };

export async function runCreateCheckout(
  stripe: CheckoutStripeClient,
  input: {
    orgId: string;
    org: { stripe_subscription_id: string | null; trial_ends_at: Date | string | null };
    plan: PlanName;
    interval: Interval;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    getCustomerId: () => Promise<string>;
    now: Date;
  }
): Promise<CreateCheckoutResult> {
  // Existing subscription → change its price and metadata (no new checkout). The same plan is allowed.
  if (input.org.stripe_subscription_id) {
    const subscription = await stripe.subscriptions.retrieve(input.org.stripe_subscription_id);
    const itemId = subscription.items.data[0]?.id;
    if (itemId) {
      const updated = await stripe.subscriptions.update(
        input.org.stripe_subscription_id,
        subscriptionPlanUpdateParams(itemId, input.priceId, input.plan, input.interval)
      );
      return { kind: 'updated', subscription: updated };
    }
  }

  const customerId = await input.getCustomerId();
  // Only an org without a subscription is on the GenSmart (DB-only) trial.
  const trialEndsAt = input.org.trial_ends_at === null ? null : new Date(input.org.trial_ends_at);
  const trialEnd = input.org.stripe_subscription_id ? null : checkoutTrialEnd(trialEndsAt, input.now);

  const session = await stripe.checkout.sessions.create(
    checkoutSessionParams({
      orgId: input.orgId,
      customerId,
      priceId: input.priceId,
      plan: input.plan,
      interval: input.interval,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      trialEnd,
    })
  );
  return { kind: 'checkout', url: session.url };
}
