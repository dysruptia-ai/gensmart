/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Prompt 22: the Solo plan includes all six channels. Covers the API middleware
 * (checkChannelAccess) and the message worker's gate (isChannelAllowedOnPlan), with fakes only.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { PLAN_LIMITS, getMinimumPlanForChannel, isChannelAllowedOnPlan } from '@gensmart/shared';
import { checkChannelAccess } from './planLimits';

const SIX = ['web', 'whatsapp', 'email', 'telegram', 'facebook', 'instagram'] as const;

async function runMiddleware(plan: string | undefined, channel: string) {
  let statusCode: number | null = null;
  let nextCalled = false;
  let nextErr: unknown;
  const req = { org: plan === undefined ? undefined : { plan } } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json() { return this; },
  } as unknown as Response;
  const next: NextFunction = (err?: unknown) => { nextCalled = true; nextErr = err; };
  await checkChannelAccess(channel)(req, res, next);
  return { statusCode, nextCalled, nextErr };
}

describe('Solo plan channels', () => {
  test('PLAN_LIMITS.solo.channels lists the six channels in the same order as Starter', () => {
    assert.deepEqual([...PLAN_LIMITS.solo.channels], [...SIX]);
    assert.deepEqual([...PLAN_LIMITS.solo.channels], [...PLAN_LIMITS.starter.channels]);
  });

  test('getMinimumPlanForChannel returns solo for every channel', () => {
    for (const ch of SIX) assert.equal(getMinimumPlanForChannel(ch), 'solo', ch);
    assert.equal(getMinimumPlanForChannel('fax'), null);
  });

  test('middleware lets a Solo org connect each of the six channels', async () => {
    for (const ch of SIX) {
      const r = await runMiddleware('solo', ch);
      assert.equal(r.statusCode, null, ch);
      assert.equal(r.nextCalled, true, ch);
      assert.equal(r.nextErr, undefined, ch);
    }
  });

  test('middleware defaults a missing org plan to solo and still allows the six channels', async () => {
    for (const ch of SIX) assert.equal((await runMiddleware(undefined, ch)).nextCalled, true, ch);
  });

  test('middleware still rejects an unknown channel with 403', async () => {
    const r = await runMiddleware('solo', 'fax');
    assert.equal(r.statusCode, 403);
    assert.equal(r.nextCalled, false);
  });

  test('worker gate (isChannelAllowedOnPlan) allows the six channels on Solo', () => {
    for (const ch of SIX) assert.equal(isChannelAllowedOnPlan('solo', ch), true, ch);
    assert.equal(isChannelAllowedOnPlan('solo', 'fax'), false);
    assert.equal(isChannelAllowedOnPlan('unknown-plan', 'telegram'), true);
  });
});
