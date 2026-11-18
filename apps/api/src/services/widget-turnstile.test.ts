/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Web widget human verification (prompt 15): strict Turnstile check, the verify route logic and the
 * reserved channel_metadata key. Simulated fetch, Redis and Postgres: no network, DB or Redis.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  allowedTurnstileHostnames,
  resetTurnstileWarningsForTests,
  verifyTurnstileTokenStrict,
  WIDGET_TURNSTILE_ACTION,
} from './turnstile.service';
import { RESERVED_CHANNEL_KEYS, withoutReservedChannelKeys } from './channel-metadata-keys';
import {
  SQL_FIND_WEB_SESSION,
  SQL_MARK_VERIFIED,
  VERIFY_LIMITS,
  verifyWidgetSession,
  type WidgetVerifyDeps,
} from './widget-verify.service';

const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const SECRET = '1x0000000000000000000000000000000AA'; // Cloudflare's public "always passes" test secret
const PROD_HOSTS = allowedTurnstileHostnames('production');

interface FetchCall { url: string; body: string; signal: AbortSignal | null }

function fakeFetch(answer: unknown, opts: { status?: number; calls?: FetchCall[] } = {}): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    opts.calls?.push({ url: String(url), body: String(init?.body ?? ''), signal: init?.signal ?? null });
    return new Response(JSON.stringify(answer), { status: opts.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

function quietLog(): { warn: (m: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { warn: (m) => lines.push(m), lines };
}

const strict = (fetchImpl: typeof fetch, over: Partial<Parameters<typeof verifyTurnstileTokenStrict>[2]> = {}) =>
  verifyTurnstileTokenStrict(TOKEN, '203.0.113.7', {
    expectedAction: WIDGET_TURNSTILE_ACTION,
    allowedHostnames: PROD_HOSTS,
    secret: SECRET,
    fetchImpl,
    log: quietLog(),
    ...over,
  });

describe('turnstile.service: verifyTurnstileTokenStrict', () => {
  const good = { success: true, action: 'widget_session', hostname: 'www.gensmart.co' };

  test('success with the expected action and hostname → true; sends secret, token and IP once', async () => {
    const calls: FetchCall[] = [];
    assert.equal(await strict(fakeFetch(good, { calls })), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const form = new URLSearchParams(calls[0]!.body);
    assert.equal(form.get('response'), TOKEN);
    assert.equal(form.get('secret'), SECRET);
    assert.equal(form.get('remoteip'), '203.0.113.7');
    assert.ok(calls[0]!.signal, 'request has a timeout signal');
  });

  test('apex hostname is allowed; localhost only in development', async () => {
    assert.equal(await strict(fakeFetch({ ...good, hostname: 'gensmart.co' })), true);
    assert.equal(await strict(fakeFetch({ ...good, hostname: 'localhost' })), false);
    assert.equal(await strict(fakeFetch({ ...good, hostname: 'localhost' }), { allowedHostnames: allowedTurnstileHostnames('development') }), true);
    assert.ok(!allowedTurnstileHostnames('production').includes('localhost'));
    assert.ok(!allowedTurnstileHostnames('test').includes('localhost'));
  });

  test('failure, wrong action, foreign or missing hostname, HTTP error, bad JSON → false', async () => {
    assert.equal(await strict(fakeFetch({ success: false, 'error-codes': ['invalid-input-response'] })), false);
    assert.equal(await strict(fakeFetch({ ...good, success: 'true' })), false);
    assert.equal(await strict(fakeFetch({ ...good, action: 'register' })), false);
    assert.equal(await strict(fakeFetch({ ...good, action: undefined })), false);
    assert.equal(await strict(fakeFetch({ ...good, hostname: 'evil.example' })), false);
    assert.equal(await strict(fakeFetch({ ...good, hostname: 'www.gensmart.co.evil.example' })), false);
    assert.equal(await strict(fakeFetch({ ...good, hostname: undefined })), false);
    assert.equal(await strict(fakeFetch(good, { status: 500 })), false);
    assert.equal(await strict(fakeFetch(null)), false);
    const notJson = (async () => new Response('<html>', { status: 200 })) as typeof fetch;
    assert.equal(await strict(notJson), false);
  });

  test('timeout → false, without throwing', async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        // AbortSignal.timeout's timer is unref'd: keep the event loop alive until it fires.
        const keepAlive = setTimeout(() => reject(new Error('timeout did not fire')), 5000);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(keepAlive);
          reject(init.signal!.reason);
        });
      })) as unknown as typeof fetch;
    const started = Date.now();
    assert.equal(await strict(hang, { timeoutMs: 50 }), false);
    assert.ok(Date.now() - started < 2000);
  });

  test('network error → false, logs only the error name (never token or secret)', async () => {
    const log = quietLog();
    const boom = (async () => { throw new TypeError(`fetch failed ${TOKEN} ${SECRET}`); }) as typeof fetch;
    assert.equal(await strict(boom, { log }), false);
    assert.equal(log.lines.length, 1);
    assert.ok(!log.lines.join('\n').includes(TOKEN));
    assert.ok(!log.lines.join('\n').includes(SECRET));
  });

  test('missing secret → false without calling Cloudflare; warns once per process', async () => {
    resetTurnstileWarningsForTests();
    const calls: FetchCall[] = [];
    const log = quietLog();
    assert.equal(await strict(fakeFetch(good, { calls }), { secret: '', log }), false);
    assert.equal(await strict(fakeFetch(good, { calls }), { secret: '', log }), false);
    assert.equal(calls.length, 0);
    assert.equal(log.lines.length, 1);
  });

  test('empty or oversized token → false without calling Cloudflare', async () => {
    const calls: FetchCall[] = [];
    const run = (t: string) => verifyTurnstileTokenStrict(t, undefined, {
      expectedAction: WIDGET_TURNSTILE_ACTION, allowedHostnames: PROD_HOSTS, secret: SECRET, fetchImpl: fakeFetch(good, { calls }), log: quietLog(),
    });
    assert.equal(await run(''), false);
    assert.equal(await run('a'.repeat(2049)), false);
    assert.equal(calls.length, 0);
  });
});

// ── Verify route logic ───────────────────────────────────────────────────────

const AGENT_A = '11111111-1111-4111-8111-111111111111';
const AGENT_B = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';

interface Row { id: string; agentId: string; channel: string; status: string; verifiedAt: string | null }

function routeHarness(rows: Row[], tokenOk = true) {
  const counters = new Map<string, number>();
  const verifyCalls: Array<{ token: string; ip: string }> = [];
  const writes: Array<{ sessionId: string; agentId: string }> = [];
  // Same filters as SQL_FIND_WEB_SESSION / SQL_MARK_VERIFIED: id + agent_id + channel = 'web'.
  const match = (sid: string, aid: string) => rows.find((r) => r.id === sid && r.agentId === aid && r.channel === 'web');
  const deps: WidgetVerifyDeps = {
    hit: async (key, max) => {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return n <= max;
    },
    findSession: async (sid, aid) => {
      const r = match(sid, aid);
      return r ? { status: r.status, verified: r.verifiedAt !== null } : null;
    },
    markVerified: async (sid, aid) => {
      writes.push({ sessionId: sid, agentId: aid });
      const r = match(sid, aid);
      if (!r || r.status === 'closed') return 0;
      r.verifiedAt = new Date().toISOString();
      return 1;
    },
    verifyToken: async (token, ip) => {
      verifyCalls.push({ token, ip });
      return tokenOk;
    },
  };
  const call = (over: Partial<{ agentId: string; sessionId: string; token: unknown; ip: string }> = {}) =>
    verifyWidgetSession({ agentId: AGENT_A, sessionId: SESSION, token: TOKEN, ip: '203.0.113.7', ...over }, deps);
  return { deps, call, counters, verifyCalls, writes, rows };
}

const webRow = (over: Partial<Row> = {}): Row => ({ id: SESSION, agentId: AGENT_A, channel: 'web', status: 'active', verifiedAt: null, ...over });

describe('POST /api/widget/:agentId/session/:sessionId/verify (logic)', () => {
  test('valid token → verified and written once with the same filters', async () => {
    const h = routeHarness([webRow()]);
    assert.deepEqual(await h.call(), { kind: 'done', verified: true });
    assert.equal(h.verifyCalls.length, 1);
    assert.deepEqual(h.writes, [{ sessionId: SESSION, agentId: AGENT_A }]);
    assert.ok(h.rows[0]!.verifiedAt);
  });

  test("another agent's session → 404, Cloudflare not called, nothing written", async () => {
    const h = routeHarness([webRow()]);
    assert.deepEqual(await h.call({ agentId: AGENT_B }), { kind: 'not_found' });
    assert.equal(h.verifyCalls.length, 0);
    assert.equal(h.writes.length, 0);
  });

  test('closed session, non-web conversation or unknown session → 404', async () => {
    assert.deepEqual(await routeHarness([webRow({ status: 'closed' })]).call(), { kind: 'not_found' });
    assert.deepEqual(await routeHarness([webRow({ channel: 'whatsapp' })]).call(), { kind: 'not_found' });
    assert.deepEqual(await routeHarness([]).call(), { kind: 'not_found' });
    assert.deepEqual(await routeHarness([webRow()]).call({ sessionId: 'not-a-uuid' }), { kind: 'not_found' });
  });

  test('already verified → verified:true without calling Cloudflare or writing', async () => {
    const h = routeHarness([webRow({ verifiedAt: '2026-11-18T10:00:00Z' })]);
    assert.deepEqual(await h.call(), { kind: 'done', verified: true });
    assert.equal(h.verifyCalls.length, 0);
    assert.equal(h.writes.length, 0);
  });

  test('invalid token → verified:false with 200 semantics, nothing written', async () => {
    const h = routeHarness([webRow()], false);
    assert.deepEqual(await h.call(), { kind: 'done', verified: false });
    assert.equal(h.writes.length, 0);
    assert.equal(h.rows[0]!.verifiedAt, null);
  });

  test('missing, non-string or oversized token → invalid (400) before any rate limit or lookup', async () => {
    const h = routeHarness([webRow()]);
    for (const token of [undefined, '', 42, { a: 1 }, 'a'.repeat(VERIFY_LIMITS.maxTokenLength + 1)]) {
      assert.deepEqual(await h.call({ token }), { kind: 'invalid' });
    }
    assert.equal(h.counters.size, 0);
    assert.equal(h.verifyCalls.length, 0);
  });

  test('rate limits: 5 per session per hour and 20 per IP per hour → 429', async () => {
    const h = routeHarness([webRow()], false);
    for (let i = 0; i < VERIFY_LIMITS.perSessionPerHour; i++) assert.equal((await h.call()).kind, 'done');
    assert.deepEqual(await h.call(), { kind: 'rate_limited' });

    const h2 = routeHarness([], false);
    const outcomes: string[] = [];
    for (let i = 0; i < VERIFY_LIMITS.perIpPerHour + 1; i++) {
      const sid = `44444444-4444-4444-8444-${String(i).padStart(12, '0')}`;
      outcomes.push((await h2.call({ sessionId: sid })).kind);
    }
    assert.equal(outcomes.filter((k) => k === 'not_found').length, VERIFY_LIMITS.perIpPerHour);
    assert.equal(outcomes.at(-1), 'rate_limited');
    assert.ok([...h2.counters.keys()].every((k) => k.startsWith('rl:widget:verify:')));
  });

  test('SQL: read and write filter by id + agent_id + web channel; the write skips closed sessions', () => {
    for (const sql of [SQL_FIND_WEB_SESSION, SQL_MARK_VERIFIED]) {
      assert.match(sql, /WHERE id = \$1 AND agent_id = \$2 AND channel = 'web'/);
    }
    assert.match(SQL_MARK_VERIFIED, /jsonb_build_object\('human_verified_at', NOW\(\)\)/);
    assert.match(SQL_MARK_VERIFIED, /status <> 'closed'/);
    assert.ok(!/\$3/.test(SQL_MARK_VERIFIED), 'no client value besides the two ids');
  });

  test('route wiring: smallJson body, strict Turnstile with the widget action, generic 404 and RATE_LIMIT 429', () => {
    const src = readFileSync(join(__dirname, '../routes/widget.ts'), 'utf8');
    assert.match(src, /router\.post\(\s*'\/:agentId\/session\/:sessionId\/verify'/);
    assert.match(src, /verifyTurnstileTokenStrict\(token, ip, \{ expectedAction: WIDGET_TURNSTILE_ACTION \}\)/);
    assert.match(src, /new AppError\(404, 'Session not found', 'NOT_FOUND'\)/);
    assert.match(src, /new AppError\(429, '[^']+', 'RATE_LIMIT'\)/);
    // GET session exposes only a boolean, never the date
    assert.match(src, /res\.json\(\{ valid: true, verified: conv\.verified === true \}\)/);
    assert.equal(WIDGET_TURNSTILE_ACTION, 'widget_session');
  });
});

describe('channel-metadata-keys: human_verified_at is server-only', () => {
  test('dropped from client-supplied channel_metadata, other keys kept', () => {
    assert.ok(RESERVED_CHANNEL_KEYS.has('human_verified_at'));
    assert.deepEqual(
      withoutReservedChannelKeys({ human_verified_at: '2026-11-18T10:00:00Z', ip_hash: 'x', wa_from: 'y', source: 'api' }),
      { source: 'api' }
    );
  });

  test('POST /api/conversations stores only the stripped metadata', () => {
    const src = readFileSync(join(__dirname, '../routes/conversations.ts'), 'utf8');
    assert.match(src, /JSON\.stringify\(withoutReservedChannelKeys\(channelMetadata\)\)/);
    // No other client write of channel_metadata in that router
    assert.equal((src.match(/channel_metadata\s*=/g) ?? []).length, 0);
  });
});
