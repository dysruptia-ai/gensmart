/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-44): filtros (canal, agente, etiqueta, puntaje, solo el agente) y orden de la lista.
 * - Siempre: parseListFilters y las condiciones (OR dentro de un filtro, AND entre filtros).
 * - Con INBOX_FILTERS_DB_TEST=1: el endpoint real con filas propias.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_ONLY_SQL, buildInboxConditions } from './inbox-query.service';
import { parseListFilters } from './inbox-list-params';

const ORG = '00000000-0000-0000-0000-000000000001';
const USER = '00000000-0000-0000-0000-000000000002';
const A1 = '00000000-0000-0000-0000-0000000000a1';
const A2 = '00000000-0000-0000-0000-0000000000a2';

test('parseListFilters: listas, repetidos y los parámetros viejos', () => {
  const f = parseListFilters({ channels: 'web,whatsapp', channel: 'web', agentIds: [A1, A2], agentId: A1, labelIds: 'x', minScore: '7', agentOnly: '1' });
  assert.deepEqual(f.channels, ['web', 'whatsapp', 'web']);
  assert.deepEqual(f.agentIds, [A1, A2, A1]);
  assert.deepEqual(f.labelIds, ['x']);
  assert.equal(f.minScore, 7);
  assert.equal(f.agentOnly, true);
  assert.equal(parseListFilters({ minScore: 'mucho' }).minScore, null);
});

test('condiciones: OR dentro del filtro, AND entre filtros; ids inválidos no coinciden', () => {
  const f = buildInboxConditions({ orgId: ORG, userId: USER, range: 'all', channels: ['web', 'whatsapp'], agentIds: [A1, A2], minScore: 7, agentOnly: true });
  assert.ok(f.conditions.includes('c.channel = ANY($2::text[])'));
  assert.ok(f.conditions.includes('c.ai_score >= $3'));
  assert.ok(f.conditions.includes(AGENT_ONLY_SQL));
  assert.ok(f.conditions.includes('c.agent_id = ANY($4::uuid[])'));
  assert.deepEqual(f.params, [ORG, ['web', 'whatsapp'], 7, [A1, A2]]);
  assert.ok(buildInboxConditions({ orgId: ORG, userId: USER, labelIds: ['nope'] }).conditions.includes('FALSE'));
  assert.ok(buildInboxConditions({ orgId: ORG, userId: USER, agentId: 'nope' }).conditions.includes('FALSE'));
});

const dbEnabled = process.env['INBOX_FILTERS_DB_TEST'] === '1';

test('endpoint: filtros y orden', { skip: !dbEnabled }, async () => {
  const { startInboxFixture } = await import('./inbox-test-fixture');
  const fx = await startInboxFixture('ifilt');
  try {
    const org = await fx.makeOrg('pro');
    const other = await fx.makeOrg('pro');
    const owner = await fx.makeUser(org, 'Owner', 'owner');
    const a1 = await fx.makeAgent(org);
    const a2 = await fx.makeAgent(org);
    const foreignAgent = await fx.makeAgent(other);

    const c1 = await fx.makeConversation(org, a1); // web, a1, score 8, etiqueta L1
    const c2 = await fx.makeConversation(org, a2); // whatsapp, a2, score 5, etiqueta L2
    const c3 = await fx.makeConversation(org, a1); // whatsapp, a1, score 9, tomada
    const c4 = await fx.makeConversation(org, a2); // web, a2, pidió ayuda
    await fx.query(`UPDATE conversations SET ai_score = 8, last_message_at = NOW() - interval '4 minutes' WHERE id = $1`, [c1]);
    await fx.query(`UPDATE conversations SET channel = 'whatsapp', ai_score = 5, last_message_at = NOW() - interval '3 minutes' WHERE id = $1`, [c2]);
    await fx.query(`UPDATE conversations SET channel = 'whatsapp', ai_score = 9, status = 'human_takeover', taken_over_by = $2, last_message_at = NOW() - interval '2 minutes' WHERE id = $1`, [c3, owner.id]);
    await fx.query(`UPDATE conversations SET handed_off_at = NOW(), last_message_at = NOW() - interval '1 minutes' WHERE id = $1`, [c4]);
    const l1 = (await fx.query<{ id: string }>(`INSERT INTO inbox_labels (organization_id, name) VALUES ($1, 'L1') RETURNING id`, [org])).rows[0]!.id;
    const l2 = (await fx.query<{ id: string }>(`INSERT INTO inbox_labels (organization_id, name) VALUES ($1, 'L2') RETURNING id`, [org])).rows[0]!.id;
    const foreignLabel = (await fx.query<{ id: string }>(`INSERT INTO inbox_labels (organization_id, name) VALUES ($1, 'X') RETURNING id`, [other])).rows[0]!.id;
    await fx.query(`INSERT INTO conversation_labels (conversation_id, label_id, organization_id) VALUES ($1, $2, $3), ($4, $5, $3)`, [c1, l1, org, c2, l2]);

    const list = async (qs: string) => {
      const r = await fx.call(owner.token, 'GET', `/conversations?view=all&limit=100&${qs}`);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      return (r.json['conversations'] as Array<{ id: string }>).map((x) => x.id);
    };
    const set = async (qs: string) => new Set(await list(qs));

    assert.deepEqual(await set('channels=web,whatsapp'), new Set([c1, c2, c3, c4]));
    assert.deepEqual(await set('channels=whatsapp'), new Set([c2, c3]));
    assert.deepEqual(await set('channels=whatsapp&agentIds=' + a1), new Set([c3]), 'AND entre filtros');
    assert.deepEqual(await set(`labelIds=${l1},${l2}`), new Set([c1, c2]), 'OR dentro del filtro');
    assert.deepEqual(await set(`labelIds=${l1}&minScore=7`), new Set([c1]));
    assert.deepEqual(await set('minScore=7'), new Set([c1, c3]));
    assert.deepEqual(await set('agentOnly=1'), new Set([c1, c2]), 'sin tomar, sin pedido de ayuda');
    // URLs viejas
    assert.deepEqual(await set(`agentId=${a2}`), new Set([c2, c4]));
    assert.deepEqual(await set('channel=whatsapp'), new Set([c2, c3]));
    // ids ajenos: no coinciden, no dan error
    assert.deepEqual(await set(`agentIds=${foreignAgent}`), new Set());
    assert.deepEqual(await set(`labelIds=${foreignLabel}`), new Set());
    assert.deepEqual(await set('labelIds=no-es-uuid'), new Set());
    // orden
    assert.deepEqual(await list('order=recent'), [c4, c3, c2, c1]);
    await fx.query(`INSERT INTO conversation_reads (conversation_id, user_id, organization_id, last_read_at) SELECT id, $2, $3, NOW() FROM conversations WHERE id = ANY($1::uuid[])`, [
      [c3, c4],
      owner.id,
      org,
    ]);
    await fx.query(`UPDATE user_organizations SET inbox_read_since = NOW() - interval '1 day' WHERE user_id = $1`, [owner.id]);
    assert.deepEqual(await list('order=unread'), [c2, c1, c4, c3], 'primero las no leídas, después por el último mensaje');
    assert.equal((await fx.call(owner.token, 'GET', '/conversations?order=raro')).status, 400);
  } finally {
    await fx.cleanup();
  }
});
