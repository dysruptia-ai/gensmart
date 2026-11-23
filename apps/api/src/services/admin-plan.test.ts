/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Admin manual plan assignment (prompt 16): every change is a definitive plan. Fakes only: the SQL
 * itself is checked against a local Postgres in a ROLLBACK transaction (see the report).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SQL_ASSIGN_DEFINITIVE_PLAN,
  assignDefinitivePlan,
  type AdminPlan,
  type AdminPlanDeps,
} from './admin-plan.service';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';

interface Org {
  id: string;
  plan: string;
  trialEndsAt: string | null;
  isSuspended: boolean;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
}

function harness(orgs: Org[]) {
  const emitted: string[] = [];
  const logs: string[] = [];
  const audit: Array<Record<string, unknown>> = [];
  // Same semantics as SQL_ASSIGN_DEFINITIVE_PLAN.
  const deps: AdminPlanDeps = {
    assign: async (plan: AdminPlan, orgId: string, adminUserId: string) => {
      const o = orgs.find((x) => x.id === orgId);
      if (!o) return null;
      const prev = { plan: o.plan, isSuspended: o.isSuspended, hadTrial: o.trialEndsAt !== null };
      Object.assign(o, { plan, trialEndsAt: null, isSuspended: false });
      audit.push({ organization_id: o.id, previous_plan: prev.plan, new_plan: plan, admin_user_id: adminUserId });
      return {
        id: o.id, plan: o.plan, stripe_subscription_id: o.stripeSubscriptionId, subscription_status: o.subscriptionStatus,
        previous_plan: prev.plan, was_suspended: prev.isSuspended, had_trial: prev.hadTrial, audit_event_id: 'evt-1',
      };
    },
    emitReactivated: (orgId) => { emitted.push(orgId); },
    log: { info: (m) => logs.push(m) },
  };
  const run = (orgId: string, plan: AdminPlan = 'pro') => assignDefinitivePlan({ orgId, plan, adminUserId: ADMIN }, deps);
  return { orgs, emitted, logs, audit, run };
}

const org = (over: Partial<Org> = {}): Org => ({
  id: ORG, plan: 'solo', trialEndsAt: null, isSuspended: false, stripeSubscriptionId: null, subscriptionStatus: 'active', ...over,
});

describe('assignDefinitivePlan', () => {
  test('org on trial → plan set, trial cleared, not suspended, no reactivation event', async () => {
    const h = harness([org({ trialEndsAt: '2026-11-30T00:00:00Z' })]);
    assert.deepEqual(await h.run(ORG), { kind: 'ok', plan: 'pro', trialCleared: true, reactivated: false });
    assert.equal(h.orgs[0]!.trialEndsAt, null);
    assert.equal(h.orgs[0]!.isSuspended, false);
    assert.deepEqual(h.emitted, []);
  });

  test('suspended org → reactivated: true and org:reactivated emitted once for that org', async () => {
    const h = harness([org({ isSuspended: true, subscriptionStatus: 'canceled' }), org({ id: OTHER, isSuspended: true })]);
    const out = await h.run(ORG);
    assert.deepEqual(out, { kind: 'ok', plan: 'pro', trialCleared: true, reactivated: true });
    assert.equal(h.orgs[0]!.isSuspended, false);
    assert.deepEqual(h.emitted, [ORG]);
    assert.equal(h.orgs[1]!.isSuspended, true, 'other orgs untouched');
    // subscription_status is never changed (it does not gate access)
    assert.equal(h.orgs[0]!.subscriptionStatus, 'canceled');
  });

  test('live Stripe subscription → change applied with STRIPE_SUBSCRIPTION_ACTIVE warning', async () => {
    for (const status of ['active', 'trialing']) {
      const h = harness([org({ stripeSubscriptionId: 'sub_test', subscriptionStatus: status })]);
      const out = await h.run(ORG, 'enterprise');
      assert.deepEqual(out, { kind: 'ok', plan: 'enterprise', trialCleared: true, reactivated: false, warning: 'STRIPE_SUBSCRIPTION_ACTIVE' });
      assert.equal(h.orgs[0]!.plan, 'enterprise');
    }
  });

  test('Stripe subscription not live, or no Stripe at all → no warning', async () => {
    for (const o of [org({ stripeSubscriptionId: 'sub_test', subscriptionStatus: 'past_due' }), org({ subscriptionStatus: 'active' })]) {
      const out = await harness([o]).run(ORG);
      assert.ok(out.kind === 'ok' && out.warning === undefined);
    }
  });

  test('unknown id → not_found, nothing emitted or logged; non-UUID never reaches the database', async () => {
    const h = harness([org()]);
    assert.deepEqual(await h.run(OTHER), { kind: 'not_found' });
    let called = false;
    const out = await assignDefinitivePlan(
      { orgId: "x' OR 1=1 --", plan: 'pro', adminUserId: ADMIN },
      { assign: async () => { called = true; return null; }, emitReactivated: () => {}, log: { info: () => {} } }
    );
    assert.deepEqual(out, { kind: 'not_found' });
    assert.equal(called, false);
    assert.deepEqual(h.emitted, []);
    assert.deepEqual(h.logs, []);
  });

  test('audit + log carry ids and plan names only', async () => {
    const h = harness([org({ plan: 'starter' })]);
    await h.run(ORG);
    assert.deepEqual(h.audit, [{ organization_id: ORG, previous_plan: 'starter', new_plan: 'pro', admin_user_id: ADMIN }]);
    assert.equal(h.logs.length, 1);
    assert.match(h.logs[0]!, new RegExp(`org ${ORG}: starter -> pro by admin ${ADMIN}`));
    assert.ok(!/@/.test(h.logs[0]!), 'no emails');
  });
});

describe('SQL and route wiring', () => {
  test('one statement: locks, sets plan + clears trial + reactivates, keeps subscription_status, audits', () => {
    const sql = SQL_ASSIGN_DEFINITIVE_PLAN;
    assert.match(sql, /WHERE id = \$2\s+FOR UPDATE/);
    assert.match(sql, /SET plan = \$1, trial_ends_at = NULL, is_suspended = false, updated_at = NOW\(\)/);
    assert.ok(!/subscription_status\s*=/.test(sql), 'subscription_status is not written');
    assert.match(sql, /prev\.is_suspended AS was_suspended/);
    assert.match(sql, /INSERT INTO billing_events \(organization_id, stripe_event_id, event_type, amount, metadata, created_at\)/);
    assert.match(sql, /'admin_plan_change'/);
    assert.match(sql, /'admin_user_id', \$3::text/);
  });

  test('route stays behind requireAuth + requireSuperAdmin and answers 404 with AppError', () => {
    const src = readFileSync(join(__dirname, '../routes/admin.ts'), 'utf8');
    assert.match(src, /router\.use\(requireAuth\);\s*router\.use\(requireSuperAdmin\);/);
    assert.match(src, /new AppError\(404, 'Organization not found', 'NOT_FOUND'\)/);
    assert.match(src, /adminUserId: req\.user!\.userId/);
    assert.ok(!src.includes("'UPDATE organizations SET plan = $1, updated_at = NOW() WHERE id = $2'"), 'old UPDATE removed');
  });
});
