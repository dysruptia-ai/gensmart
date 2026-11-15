/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Integration test against a real Postgres (opt-in: AGENT_TEMPLATES_DB_TEST=1, e.g. docker compose
 * up -d + migrations). Skipped otherwise, so CI without a database is unaffected.
 *
 * - Beta gating of agent templates (allowed_org_ids): listing and createFromTemplate.
 * - Re-running the seed never overwrites allowed_org_ids.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, query } from '../config/database';
import { createFromTemplate, getTemplates } from './agent.service';
import { seedAgentTemplates } from '../db/seeds/agent-templates.seed';

const enabled = process.env['AGENT_TEMPLATES_DB_TEST'] === '1';

after(async () => {
  if (enabled) await pool.end();
});

async function errorOf(p: Promise<unknown>): Promise<{ statusCode: unknown; code: unknown; message: unknown }> {
  try {
    await p;
  } catch (err) {
    const e = err as { statusCode?: unknown; code?: unknown; message?: unknown };
    return { statusCode: e.statusCode, code: e.code, message: e.message };
  }
  throw new Error('expected an error');
}

test('allowed_org_ids gates listing and createFromTemplate without revealing hidden templates', { skip: !enabled }, async () => {
  const orgs = await query<{ id: string }>(
    `INSERT INTO organizations (name, slug)
     SELECT 'tpl-gating-test', 'tpl-gating-test-' || gen_random_uuid() FROM generate_series(1, 2) RETURNING id`
  );
  const [inBeta, outside] = orgs.rows.map((r) => r.id) as [string, string];
  const suffix = Math.random().toString(36).slice(2);
  const ins = async (name: string, allowed: unknown): Promise<string> =>
    (await query<{ id: string }>(
      `INSERT INTO agent_templates (name, description, category, system_prompt, variables, tools, language, is_active, allowed_org_ids)
       VALUES ($1, 'd', 'test', 'p', '[]', '[]', 'es', TRUE, $2::jsonb) RETURNING id`,
      [`${name}-${suffix}`, allowed === null ? null : JSON.stringify(allowed)]
    )).rows[0]!.id;
  const templateIds: string[] = [];
  try {
    const open = await ins('tpl-open', null);
    const beta = await ins('tpl-beta', [inBeta]);
    const hidden = await ins('tpl-hidden', []);
    templateIds.push(open, beta, hidden);

    const ids = async (orgId: string) => new Set((await getTemplates(orgId)).map((t) => t.id));
    const seenIn = await ids(inBeta);
    const seenOut = await ids(outside);
    assert.ok(seenIn.has(open) && seenOut.has(open), 'NULL → every organization');
    assert.ok(seenIn.has(beta), 'included organization sees it');
    assert.ok(!seenOut.has(beta), 'organization outside the beta does not see it');
    assert.ok(!seenIn.has(hidden) && !seenOut.has(hidden), "'[]' → nobody");
    // The beta list (other organizations' ids) is never exposed.
    for (const t of await getTemplates(inBeta)) assert.ok(!('allowed_org_ids' in t));

    // Outside the beta: same error as a template that does not exist (status, code and message).
    const hiddenErr = await errorOf(createFromTemplate(outside, 'pro', beta));
    const missingErr = await errorOf(createFromTemplate(outside, 'pro', '00000000-0000-4000-8000-000000000000'));
    assert.deepEqual(hiddenErr, missingErr);
    assert.equal(hiddenErr.statusCode, 404);
    assert.deepEqual(await errorOf(createFromTemplate(inBeta, 'pro', hidden)), missingErr);
  } finally {
    await query('DELETE FROM agents WHERE organization_id = ANY($1::uuid[])', [[inBeta, outside]]);
    await query('DELETE FROM agent_templates WHERE id = ANY($1::uuid[])', [templateIds]);
    await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [[inBeta, outside]]);
  }
});

test('re-running the seed updates the template but never overwrites allowed_org_ids', { skip: !enabled }, async () => {
  await seedAgentTemplates(pool);
  const read = async () =>
    (await query<{ allowed_org_ids: unknown; system_prompt: string }>(
      `SELECT allowed_org_ids, system_prompt FROM agent_templates WHERE name = 'Vendedor Dropi' AND language = 'es'`
    )).rows[0];
  const before = await read();
  assert.ok(before, 'Vendedor Dropi inserted');
  const betaOrg = '11111111-1111-4111-8111-111111111111';
  try {
    await query(
      `UPDATE agent_templates SET allowed_org_ids = $1::jsonb, system_prompt = 'stale' WHERE name = 'Vendedor Dropi' AND language = 'es'`,
      [JSON.stringify([betaOrg])]
    );
    await seedAgentTemplates(pool);
    const afterSeed = await read();
    assert.deepEqual(afterSeed!.allowed_org_ids, [betaOrg]); // beta enabled by SQL survives
    assert.notEqual(afterSeed!.system_prompt, 'stale'); // the rest is updated
    // Existing templates keep NULL.
    const others = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM agent_templates WHERE name IN ('Mastershop Dropshipper', 'Venndelo Dropshipper') AND allowed_org_ids IS NOT NULL`
    );
    assert.equal(others.rows[0]!.n, 0);
  } finally {
    await query(
      `UPDATE agent_templates SET allowed_org_ids = $1::jsonb WHERE name = 'Vendedor Dropi' AND language = 'es'`,
      [before!.allowed_org_ids === null ? null : JSON.stringify(before!.allowed_org_ids)]
    );
  }
});
