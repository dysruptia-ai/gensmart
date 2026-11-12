/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  findConversationForOrder,
  formatNoConversationLog,
  type ConversationRow,
  type QueryFn,
} from './mcp-conversation.service';

const AGENT = '85d7549f-0ecf-43c0-b107-991fbc90bd36';
const conv = (id: string): ConversationRow => ({
  id,
  channel: 'web',
  channel_metadata: {},
  organization_id: 'org-1',
});

/**
 * Fake DB: conversations of one agent. Another ACTIVE and more recent
 * conversation (c-other) exists that must never be chosen by guessing.
 */
function fakeDb() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const run: QueryFn = async <T>(sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes("captured_variables->>'externalOrderId'")) {
      return { rows: (params[1] === 'ext-1' ? [conv('c-match')] : []) as unknown as T[] };
    }
    // Any other query (the old "latest active conversation" fallback) would find this one.
    return { rows: [conv('c-other')] as unknown as T[] };
  };
  return { run, calls };
}

test('exact externalOrderId match returns that conversation', async () => {
  const db = fakeDb();
  const found = await findConversationForOrder(AGENT, 'ext-1', db.run);
  assert.equal(found?.id, 'c-match');
  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0]!.params, [AGENT, 'ext-1']);
});

test('no match: null, even though another active conversation of the agent exists', async () => {
  const db = fakeDb();
  const found = await findConversationForOrder(AGENT, 'ext-unknown', db.run);
  assert.equal(found, null);
  assert.equal(db.calls.length, 1, 'only the exact lookup runs; no fallback query');
});

test('payload without externalOrderId: null and no query at all', async () => {
  const db = fakeDb();
  assert.equal(await findConversationForOrder(AGENT, null, db.run), null);
  assert.equal(db.calls.length, 0);
});

test('no-conversation log: fixed format, truncated ids, no buyer data', () => {
  const line = formatNoConversationLog(AGENT, 'order.status_changed', 32884475, '5c9bc81f-aaaa-bbbb-cccc-000000000000');
  assert.equal(line, '[mcp-webhook] no-conversation agent=85d7549f event=order.status_changed pin=32884475 delivery=5c9bc81f');
});

test('worker: skips notification when there is no conversation and has no fallback SQL', () => {
  const worker = readFileSync(join(__dirname, '../workers/mcp-webhook.worker.ts'), 'utf8');
  const svc = readFileSync(join(__dirname, 'mcp-conversation.service.ts'), 'utf8');
  assert.ok(worker.includes('formatNoConversationLog('), 'worker logs no-conversation');
  assert.ok(!/INTERVAL '24 hours'/.test(worker + svc), 'no time-window fallback');
  assert.ok(!/status = 'active'/.test(svc), 'no "latest active conversation" fallback');
  const afterNull = worker.slice(worker.indexOf('if (!conversation)'));
  assert.ok(
    afterNull.indexOf('return;') < afterNull.indexOf('notifyClient('),
    'returns before notifying when there is no conversation'
  );
});
