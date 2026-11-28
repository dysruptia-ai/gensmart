/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * checkout.session.completed during the GenSmart trial: the webhook calls updateOrgSubscription with
 * the Stripe status ('trialing'). Needs the local database (no Stripe, no network). The route-level
 * webhook is not exercised: it needs a signed Stripe event; this tests the function it calls.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from '../config/database';
import { updateOrgSubscription } from './stripe.service';

// Same WHERE as expireTrials() in src/index.ts (asserted below).
const EXPIRE_WHERE = `trial_ends_at IS NOT NULL AND trial_ends_at < NOW() AND is_suspended = false
         AND NOT (stripe_subscription_id IS NOT NULL AND subscription_status IN ('active', 'trialing'))`;

test('expireTrials WHERE is the one checked here', () => {
  const src = readFileSync(join(__dirname, '../index.ts'), 'utf8');
  assert.ok(src.includes(EXPIRE_WHERE));
});

test("updateOrgSubscription with 'trialing' saves the subscription, clears the trial and the suspension", async () => {
  const r = await query<{ id: string }>(
    `INSERT INTO organizations (name, slug, plan, subscription_status, trial_ends_at, is_suspended)
     VALUES ('billing-trial-test', 'billing-trial-test-' || gen_random_uuid(), 'starter', 'active',
             NOW() + INTERVAL '10 days', true) RETURNING id`
  );
  const orgId = r.rows[0]!.id;
  try {
    const end = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    await updateOrgSubscription({
      orgId, plan: 'starter', subscriptionId: 'sub_test_trialing', status: 'trialing',
      periodStart: new Date(), periodEnd: end,
    });
    const o = await query<{ stripe_subscription_id: string | null; trial_ends_at: Date | null; is_suspended: boolean; subscription_status: string }>(
      'SELECT stripe_subscription_id, trial_ends_at, is_suspended, subscription_status FROM organizations WHERE id = $1',
      [orgId]
    );
    const row = o.rows[0]!;
    assert.equal(row.stripe_subscription_id, 'sub_test_trialing');
    assert.equal(row.trial_ends_at, null);
    assert.equal(row.is_suspended, false);
    assert.equal(row.subscription_status, 'trialing');

    // Even with a past trial date left behind, expireTrials would not touch it.
    await query(`UPDATE organizations SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [orgId]);
    const hit = await query(`SELECT id FROM organizations WHERE id = $1 AND ${EXPIRE_WHERE}`, [orgId]);
    assert.equal(hit.rows.length, 0);
  } finally {
    await query('DELETE FROM organizations WHERE id = $1', [orgId]);
  }
});
