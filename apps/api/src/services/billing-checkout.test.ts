/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Paying during the GenSmart trial: checkoutTrialEnd and create-checkout with a simulated Stripe
 * client. No database, Redis or network.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { TRIAL_DEFERRED_CHARGE_MIN_HOURS } from '@gensmart/shared';
import { checkoutTrialEnd, runCreateCheckout, type CheckoutStripeClient } from './billing-checkout';

const NOW = new Date('2026-11-28T12:00:00.000Z');
const H = 60 * 60 * 1000;
const at = (ms: number): Date => new Date(NOW.getTime() + ms);

describe('checkoutTrialEnd', () => {
  test('threshold is 49 h', () => assert.equal(TRIAL_DEFERRED_CHARGE_MIN_HOURS, 49));

  test('10 days left → Unix seconds of the trial end', () => {
    const end = at(10 * 24 * H);
    assert.equal(checkoutTrialEnd(end, NOW), Math.floor(end.getTime() / 1000));
  });

  test('49 h left → timestamp', () => {
    const end = at(49 * H);
    assert.equal(checkoutTrialEnd(end, NOW), Math.floor(end.getTime() / 1000));
  });

  test('47 h left → null', () => assert.equal(checkoutTrialEnd(at(47 * H), NOW), null));
  test('expired trial → null', () => assert.equal(checkoutTrialEnd(at(-H), NOW), null));
  test('null input → null', () => assert.equal(checkoutTrialEnd(null, NOW), null));
});

interface Calls {
  sessions: Stripe.Checkout.SessionCreateParams[];
  updates: Array<{ id: string; params: Stripe.SubscriptionUpdateParams }>;
}

function fakeStripe(): { client: CheckoutStripeClient; calls: Calls; metadata: Record<string, string> } {
  const calls: Calls = { sessions: [], updates: [] };
  const metadata: Record<string, string> = { orgId: 'org-1', plan: 'starter', interval: 'monthly' };
  const sub = (): Stripe.Subscription =>
    ({ id: 'sub_1', status: 'active', metadata: { ...metadata }, items: { data: [{ id: 'si_1' }] } }) as unknown as Stripe.Subscription;
  const client: CheckoutStripeClient = {
    subscriptions: {
      retrieve: async () => sub(),
      update: async (id, params) => {
        calls.updates.push({ id, params });
        Object.assign(metadata, params.metadata as Record<string, string>);
        return sub();
      },
    },
    checkout: {
      sessions: {
        create: async (params) => {
          calls.sessions.push(params);
          return { url: 'https://checkout.test/s' } as unknown as Stripe.Checkout.Session;
        },
      },
    },
  };
  return { client, calls, metadata };
}

const base = {
  orgId: 'org-1',
  plan: 'pro' as const,
  interval: 'monthly' as const,
  priceId: 'price_pro_m',
  successUrl: 'https://app.test/ok',
  cancelUrl: 'https://app.test/no',
  getCustomerId: async () => 'cus_1',
  now: NOW,
};

describe('create-checkout (simulated Stripe)', () => {
  test('trial org without subscription, 10 days left → session carries subscription_data.trial_end', async () => {
    const { client, calls } = fakeStripe();
    const end = at(10 * 24 * H);
    const r = await runCreateCheckout(client, { ...base, org: { stripe_subscription_id: null, trial_ends_at: end } });
    assert.deepEqual(r, { kind: 'checkout', url: 'https://checkout.test/s' });
    assert.equal(calls.sessions.length, 1);
    const s = calls.sessions[0]!;
    assert.equal(s.subscription_data?.trial_end, Math.floor(end.getTime() / 1000));
    assert.deepEqual(s.subscription_data?.metadata, { orgId: 'org-1', plan: 'pro', interval: 'monthly' });
    assert.deepEqual(s.metadata, { orgId: 'org-1', plan: 'pro', interval: 'monthly', type: 'subscription' });
    assert.equal(s.customer, 'cus_1');
  });

  test('same case with 1 day left → no trial_end (charged now)', async () => {
    const { client, calls } = fakeStripe();
    await runCreateCheckout(client, { ...base, org: { stripe_subscription_id: null, trial_ends_at: at(24 * H) } });
    assert.equal(calls.sessions.length, 1);
    assert.equal('trial_end' in (calls.sessions[0]!.subscription_data ?? {}), false);
  });

  test('trial_ends_at as ISO string is accepted', async () => {
    const { client, calls } = fakeStripe();
    const end = at(5 * 24 * H);
    await runCreateCheckout(client, { ...base, org: { stripe_subscription_id: null, trial_ends_at: end.toISOString() } });
    assert.equal(calls.sessions[0]!.subscription_data?.trial_end, Math.floor(end.getTime() / 1000));
  });

  test('org with subscription → no session; subscription updated and metadata.plan changes', async () => {
    const { client, calls, metadata } = fakeStripe();
    const r = await runCreateCheckout(client, {
      ...base,
      interval: 'yearly',
      org: { stripe_subscription_id: 'sub_1', trial_ends_at: at(10 * 24 * H) },
    });
    assert.equal(r.kind, 'updated');
    assert.equal(calls.sessions.length, 0);
    assert.equal(calls.updates.length, 1);
    assert.deepEqual(calls.updates[0]!.params.items, [{ id: 'si_1', price: 'price_pro_m' }]);
    assert.equal(metadata['plan'], 'pro');
    assert.equal(metadata['interval'], 'yearly');
    assert.equal(metadata['orgId'], 'org-1', 'orgId kept (Stripe merges metadata keys)');
  });

  test('same plan as the current one is allowed', async () => {
    const { client, calls } = fakeStripe();
    await runCreateCheckout(client, { ...base, plan: 'starter', org: { stripe_subscription_id: null, trial_ends_at: null } });
    assert.equal(calls.sessions.length, 1);
    assert.equal(calls.sessions[0]!.subscription_data?.metadata?.['plan'], 'starter');
  });
});
