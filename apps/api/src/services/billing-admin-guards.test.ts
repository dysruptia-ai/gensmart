/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Prompt 17, Part B: trial banner condition, UUID guard on admin organization routes, 'canceled'
 * spelling and ids-only trial-cron log. No database, Redis or network (local HTTP server only).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express, { Request, Response, NextFunction } from 'express';
import { visibleTrialEndsAt } from './trial-banner';
import { requireUuidParam } from '../middleware/uuidParam';
import { AppError } from '../middleware/errorHandler';

const read = (rel: string): string => readFileSync(join(__dirname, rel), 'utf8');

describe('trial banner (GET /api/organization trial_ends_at)', () => {
  const TRIAL = '2026-11-30T00:00:00.000Z';

  test('Stripe subscription active or trialing → hidden even with a trial date', () => {
    for (const status of ['active', 'trialing']) {
      assert.equal(visibleTrialEndsAt({ trial_ends_at: TRIAL, has_stripe_subscription: true, subscription_status: status }), null);
    }
  });

  test('trial without Stripe → shown (also with a stale status)', () => {
    assert.equal(visibleTrialEndsAt({ trial_ends_at: TRIAL, has_stripe_subscription: false, subscription_status: 'active' }), TRIAL);
    assert.equal(visibleTrialEndsAt({ trial_ends_at: TRIAL, has_stripe_subscription: false, subscription_status: 'trialing' }), TRIAL);
  });

  test('Stripe subscription that is not live (past_due, canceled) → trial still shown', () => {
    for (const status of ['past_due', 'canceled', 'incomplete', null]) {
      assert.equal(visibleTrialEndsAt({ trial_ends_at: TRIAL, has_stripe_subscription: true, subscription_status: status }), TRIAL);
    }
  });

  test('no trial → hidden; Date values pass through unchanged', () => {
    assert.equal(visibleTrialEndsAt({ trial_ends_at: null, has_stripe_subscription: false, subscription_status: 'active' }), null);
    const d = new Date(TRIAL);
    assert.equal(visibleTrialEndsAt({ trial_ends_at: d, has_stripe_subscription: false, subscription_status: 'active' }), d);
  });

  test('getOrganization uses only a boolean and never returns it or a Stripe id', () => {
    const src = read('./organization.service.ts');
    assert.match(src, /\(o\.stripe_subscription_id IS NOT NULL\) AS has_stripe_subscription/);
    assert.match(src, /const \{ has_stripe_subscription, \.\.\.org \} = row;/);
    assert.match(src, /return \{ \.\.\.org, trial_ends_at: trialEndsAt \};/);
    assert.ok(!/o\.stripe_subscription_id,/.test(src), 'the Stripe id itself is not selected');
  });
});

describe('admin /organizations/:id UUID guard', () => {
  const ORG = '11111111-1111-4111-8111-111111111111';
  let server: Server;
  let base = '';
  const hits: string[] = [];

  before(async () => {
    // Same mounting as routes/admin.ts, with stub handlers.
    const router = express.Router();
    router.use('/organizations/:id', requireUuidParam('id', 'Organization not found'));
    const ok = (name: string) => (req: Request, res: Response) => { hits.push(name); res.json({ name, id: req.params['id'] ?? null }); };
    router.get('/organizations', ok('list'));
    router.get('/organizations/:id', ok('detail'));
    router.put('/organizations/:id/plan', ok('plan'));
    router.delete('/organizations/:id', ok('delete'));
    router.post('/organizations/:id/reset-2fa', ok('reset-2fa'));
    router.get('/mcp-providers/:id', ok('mcp'));
    const app = express();
    app.use('/api/admin', router);
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      const e = err as AppError;
      res.status(e.statusCode ?? 500).json({ error: { message: e.message, code: e.code } });
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin`;
  });
  after(() => new Promise<void>((r) => server.close(() => r())));

  const call = async (method: string, path: string) => {
    const res = await fetch(base + path, { method });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  test('non-UUID id → 404 AppError format on every organization route, handler never runs', async () => {
    hits.length = 0;
    for (const [m, p] of [
      ['GET', '/organizations/nope'], ['PUT', '/organizations/nope/plan'], ['DELETE', '/organizations/1%27%20OR%201=1'],
      ['POST', '/organizations/123/reset-2fa'],
    ] as const) {
      const r = await call(m, p);
      assert.equal(r.status, 404, `${m} ${p}`);
      assert.deepEqual(r.body, { error: { message: 'Organization not found', code: 'NOT_FOUND' } });
    }
    assert.deepEqual(hits, []);
  });

  test('UUID id passes through; list and MCP provider slugs are untouched', async () => {
    assert.deepEqual((await call('GET', `/organizations/${ORG}`)).body, { name: 'detail', id: ORG });
    assert.equal((await call('PUT', `/organizations/${ORG}/plan`)).body['name'], 'plan');
    assert.equal((await call('GET', '/organizations')).body['name'], 'list');
    assert.deepEqual((await call('GET', '/mcp-providers/dropi')).body, { name: 'mcp', id: 'dropi' });
  });

  test('routes/admin.ts mounts the guard after requireAuth + requireSuperAdmin, scoped to organizations', () => {
    const src = read('../routes/admin.ts');
    assert.match(src, /router\.use\(requireAuth\);\s*router\.use\(requireSuperAdmin\);[\s\S]*?router\.use\('\/organizations\/:id', requireUuidParam\('id', 'Organization not found'\)\);/);
    assert.ok(!/router\.param\('id'/.test(src), 'no global :id param (MCP provider ids are slugs)');
    const guard = src.indexOf("router.use('/organizations/:id'");
    assert.ok(guard > 0 && guard < src.indexOf("'/organizations/:id',"), 'guard is registered before the organization routes');
  });
});

describe("'canceled' spelling and trial-cron log", () => {
  test("account deletion writes subscription_status = 'canceled'; nothing writes 'cancelled'", () => {
    const account = read('../routes/account.ts');
    assert.match(account, /SET subscription_status = 'canceled'/);
    assert.ok(!/subscription_status = 'cancelled'/.test(account));
  });

  test('the billing card accepts the legacy spelling as canceled', () => {
    const card = read('../../../web/components/billing/CurrentPlan.tsx');
    assert.match(card, /case 'canceled':\s*\n\s*case 'cancelled':[^\n]*\n\s*return t\('billing\.currentPlan\.subscriptionCancelled'\);/);
  });

  test('expireTrials logs ids, never names', () => {
    const idx = read('../index.ts');
    const fn = idx.slice(idx.indexOf('async function expireTrials'), idx.indexOf('setInterval(() => {\n  void expireTrials();'));
    assert.match(fn, /result\.rows\.map\(r => r\.id\)\.join\(', '\)/);
    assert.ok(!/r\.name|org\.name/.test(fn), 'no organization name in the cron logs');
  });
});
