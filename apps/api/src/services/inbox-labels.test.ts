/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-43): etiquetas de conversación.
 * Con INBOX_LABELS_DB_TEST=1 (Postgres local): CRUD con roles, PUT labels, tope, CASCADE y la lista.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INBOX_LIMITS } from '@gensmart/shared';

const dbEnabled = process.env['INBOX_LABELS_DB_TEST'] === '1';

test('etiquetas: CRUD, PUT labels, tope, CASCADE y lista', { skip: !dbEnabled }, async () => {
  const { startInboxFixture, errorCode } = await import('./inbox-test-fixture');
  const f = await startInboxFixture('labels');
  try {
    const orgId = await f.makeOrg();
    const owner = await f.makeUser(orgId, 'Olga', 'owner');
    const admin = await f.makeUser(orgId, 'Adan', 'admin');
    const ana = await f.makeUser(orgId, 'Ana', 'member');
    const otherOrg = await f.makeOrg();
    const stranger = await f.makeUser(otherOrg, 'Extra', 'owner');
    const agentId = await f.makeAgent(orgId);
    const c1 = await f.makeConversation(orgId, agentId);
    const c2 = await f.makeConversation(orgId, agentId);

    const create = async (token: string, name: string) => f.call(token, 'POST', '/inbox-labels', { name });
    assert.equal((await create(ana.token, 'B2B')).status, 403);
    const b2b = ((await create(owner.token, '  B2B  ')).json['label'] as { id: string; name: string });
    assert.equal(b2b.name, 'B2B');
    const vol = ((await create(admin.token, 'volumen')).json['label'] as { id: string }).id;
    const recl = ((await create(owner.token, 'Reclamo')).json['label'] as { id: string }).id;
    assert.equal((await create(owner.token, '   ')).status, 400);
    assert.equal((await create(owner.token, 'x'.repeat(31))).status, 400);
    assert.equal((await create(owner.token, 'ñ'.repeat(30))).status, 201, '30 caracteres con tilde');
    const dup = await create(owner.token, 'b2b');
    assert.equal(dup.status, 409);
    assert.equal(errorCode(dup), 'label_taken');
    assert.equal(errorCode(await f.call(owner.token, 'PATCH', `/inbox-labels/${vol}`, { name: 'B2B' })), 'label_taken');
    assert.equal((await f.call(ana.token, 'PATCH', `/inbox-labels/${vol}`, { name: 'Vol' })).status, 403);
    assert.equal((await f.call(admin.token, 'PATCH', `/inbox-labels/${vol}`, { name: 'Volumen' })).status, 200);
    const foreignLabel = ((await create(stranger.token, 'Ajena')).json['label'] as { id: string }).id;

    // PUT labels: cualquier rol; id de otra organización → 400
    const bad = await f.call(ana.token, 'PUT', `/conversations/${c1}/labels`, { labelIds: [b2b.id, foreignLabel] });
    assert.equal(bad.status, 400);
    assert.equal((await f.call(stranger.token, 'PUT', `/conversations/${c1}/labels`, { labelIds: [foreignLabel] })).status, 404);
    const put = await f.call(ana.token, 'PUT', `/conversations/${c1}/labels`, { labelIds: [vol, b2b.id] });
    assert.equal(put.status, 200);
    assert.deepEqual((put.json['labels'] as Array<{ name: string }>).map((l) => l.name), ['B2B', 'Volumen']);
    await f.call(ana.token, 'PUT', `/conversations/${c2}/labels`, { labelIds: [recl, b2b.id] });

    // Lista y detalle con labels en orden alfabético
    const list = (await f.call(ana.token, 'GET', '/conversations?range=all')).json['conversations'] as Array<{ id: string; labels: Array<{ name: string }> }>;
    assert.deepEqual(list.find((c) => c.id === c1)!.labels.map((l) => l.name), ['B2B', 'Volumen']);
    const detail = (await f.call(ana.token, 'GET', `/conversations/${c2}`)).json['conversation'] as { labels: Array<{ name: string }> };
    assert.deepEqual(detail.labels.map((l) => l.name), ['B2B', 'Reclamo']);

    // Conteos del catálogo
    const catalog = (await f.call(ana.token, 'GET', '/inbox-labels')).json['labels'] as Array<{ id: string; name: string; conversationCount: number }>;
    assert.deepEqual(
      catalog.filter((l) => !l.name.startsWith('ñ')).map((l) => [l.name, l.conversationCount]),
      [['B2B', 2], ['Reclamo', 1], ['Volumen', 1]]
    );
    assert.ok(!catalog.some((l) => l.id === foreignLabel));

    // Tope de 20 por conversación
    const many: string[] = [];
    for (let i = 0; i < INBOX_LIMITS.labelsPerConversation + 1; i++) {
      many.push(((await create(owner.token, `Lote ${i}`)).json['label'] as { id: string }).id);
    }
    const over = await f.call(ana.token, 'PUT', `/conversations/${c1}/labels`, { labelIds: many });
    assert.equal(over.status, 422);
    assert.equal(errorCode(over), 'conversation_labels_limit');
    assert.equal((await f.call(ana.token, 'PUT', `/conversations/${c1}/labels`, { labelIds: many.slice(0, 20) })).status, 200);
    await f.call(ana.token, 'PUT', `/conversations/${c1}/labels`, { labelIds: [vol, b2b.id] });

    // Tope por organización
    await f.query(`INSERT INTO inbox_labels (organization_id, name) SELECT $1, 'Relleno ' || g FROM generate_series(1, $2::int) g`, [
      orgId,
      INBOX_LIMITS.labelsPerOrg - 4 - many.length,
    ]);
    const overOrg = await create(owner.token, 'Una más');
    assert.equal(overOrg.status, 422);
    assert.equal(errorCode(overOrg), 'labels_limit');

    // CASCADE: borrar la etiqueta la quita de las conversaciones; la conversación sigue
    assert.equal((await f.call(ana.token, 'DELETE', `/inbox-labels/${b2b.id}`)).status, 403);
    assert.equal((await f.call(owner.token, 'DELETE', `/inbox-labels/${b2b.id}`)).status, 204);
    const after = (await f.call(ana.token, 'GET', `/conversations/${c1}`)).json['conversation'] as { labels: Array<{ name: string }> };
    assert.deepEqual(after.labels.map((l) => l.name), ['Volumen']);
    // CASCADE: borrar la conversación quita sus filas de unión
    await f.query('DELETE FROM messages WHERE conversation_id = $1', [c2]);
    await f.query('DELETE FROM conversations WHERE id = $1', [c2]);
    assert.equal((await f.query('SELECT 1 FROM conversation_labels WHERE conversation_id = $1', [c2])).rows.length, 0);
  } finally {
    await f.cleanup();
  }
});
