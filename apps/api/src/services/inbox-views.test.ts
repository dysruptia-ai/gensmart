/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-44): vistas guardadas (personales).
 * - Siempre: la validación de filters y el mapa estado → vista.
 * - Con INBOX_VIEWS_DB_TEST=1: /api/inbox-views real con filas propias.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INBOX_LIMITS } from '@gensmart/shared';
import { viewFiltersSchema, viewToFilterInput } from './inbox-views.service';

test('filters: claves conocidas; una desconocida no valida', () => {
  assert.ok(viewFiltersSchema.safeParse({ channels: ['web'], minScore: 7, state: 'agent_only', allTime: true }).success);
  assert.ok(!viewFiltersSchema.safeParse({ color: 'rojo' }).success);
  assert.ok(!viewFiltersSchema.safeParse({ minScore: 6 }).success);
  assert.ok(!viewFiltersSchema.safeParse({ state: 'todas' }).success);
});

test('estado → vista de la lista', () => {
  const base = { orgId: 'o', userId: 'u', timezone: null };
  assert.equal(viewToFilterInput({}, base).view, 'all');
  assert.equal(viewToFilterInput({ state: 'needs' }, base).view, 'needs');
  assert.equal(viewToFilterInput({ state: 'mine' }, base).view, 'mine');
  assert.equal(viewToFilterInput({ state: 'closed' }, base).view, 'closed');
  const ao = viewToFilterInput({ state: 'agent_only', allTime: true }, base);
  assert.equal(ao.view, 'all');
  assert.equal(ao.agentOnly, true);
  assert.equal(ao.range, 'all');
});

const dbEnabled = process.env['INBOX_VIEWS_DB_TEST'] === '1';

test('endpoint: CRUD, personales, 409, tope, limpieza y count', { skip: !dbEnabled }, async () => {
  const { startInboxFixture, errorCode } = await import('./inbox-test-fixture');
  const fx = await startInboxFixture('iviews');
  try {
    const org = await fx.makeOrg('pro');
    const other = await fx.makeOrg('pro');
    const owner = await fx.makeUser(org, 'Owner', 'owner');
    const member = await fx.makeUser(org, 'Ana', 'member');
    const outsider = await fx.makeUser(other, 'Otro', 'owner');
    const agent = await fx.makeAgent(org);
    const c1 = await fx.makeConversation(org, agent);
    const c2 = await fx.makeConversation(org, agent);
    await fx.makeConversation(org, agent);
    const label = (await fx.query<{ id: string }>(`INSERT INTO inbox_labels (organization_id, name) VALUES ($1, 'Pago') RETURNING id`, [org])).rows[0]!.id;
    const gone = (await fx.query<{ id: string }>(`INSERT INTO inbox_labels (organization_id, name) VALUES ($1, 'Se va') RETURNING id`, [org])).rows[0]!.id;
    await fx.query(`INSERT INTO conversation_labels (conversation_id, label_id, organization_id) VALUES ($1, $3, $4), ($2, $3, $4)`, [c1, c2, label, org]);

    const created = await fx.call(member.token, 'POST', '/inbox-views', { name: '  Pago pendiente ', filters: { labelIds: [label, gone], state: 'open' } });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const view = created.json['view'] as { id: string; name: string; count: number };
    assert.equal(view.name, 'Pago pendiente');
    assert.equal(view.count, 2);

    assert.equal(errorCode(await fx.call(member.token, 'POST', '/inbox-views', { name: 'PAGO PENDIENTE' })), 'view_name_taken');
    assert.equal((await fx.call(member.token, 'POST', '/inbox-views', { name: '   ' })).status, 400);
    assert.equal((await fx.call(member.token, 'POST', '/inbox-views', { name: 'x'.repeat(41) })).status, 400);
    assert.equal((await fx.call(member.token, 'POST', '/inbox-views', { name: 'Raro', filters: { color: 'rojo' } })).status, 400);

    // personales: el owner no la ve ni la toca (404)
    assert.deepEqual((await fx.call(owner.token, 'GET', '/inbox-views')).json['views'], []);
    assert.equal((await fx.call(owner.token, 'PATCH', `/inbox-views/${view.id}`, { name: 'Mía' })).status, 404);
    assert.equal((await fx.call(owner.token, 'DELETE', `/inbox-views/${view.id}`)).status, 404);
    assert.equal((await fx.call(outsider.token, 'DELETE', `/inbox-views/${view.id}`)).status, 404);

    // la lista de la vista (GET /conversations?savedView=) y los filtros del panel encima (AND)
    const ids = async (token: string, qs: string) =>
      new Set(((await fx.call(token, 'GET', `/conversations?limit=100&${qs}`)).json['conversations'] as Array<{ id: string }>).map((r) => r.id));
    assert.deepEqual(await ids(member.token, `savedView=${view.id}`), new Set([c1, c2]));
    await fx.query(`UPDATE conversations SET channel = 'whatsapp' WHERE id = $1`, [c2]);
    assert.deepEqual(await ids(member.token, `savedView=${view.id}&channels=whatsapp`), new Set([c2]));
    // la vista de otra persona se ignora: queda la lista pedida (la web vuelve a Todas)
    assert.equal((await ids(owner.token, `view=all&savedView=${view.id}`)).size, 3);

    // la etiqueta borrada se quita de filters al leer, sin error
    await fx.query('DELETE FROM inbox_labels WHERE id = $1', [gone]);
    const listed = (await fx.call(member.token, 'GET', '/inbox-views')).json['views'] as Array<{ filters: { labelIds: string[] }; count: number }>;
    assert.deepEqual(listed[0]!.filters.labelIds, [label]);
    const stored = await fx.query<{ filters: { labelIds: string[] } }>('SELECT filters FROM inbox_views WHERE id = $1', [view.id]);
    assert.deepEqual(stored.rows[0]!.filters.labelIds, [label]);

    // editar
    const patched = await fx.call(member.token, 'PATCH', `/inbox-views/${view.id}`, { name: 'Pago', filters: { state: 'closed' } });
    assert.equal(patched.status, 200);
    assert.equal((patched.json['view'] as { count: number }).count, 0);

    // tope de 20
    for (let i = 1; i < INBOX_LIMITS.savedViewsPerUser; i++) {
      assert.equal((await fx.call(member.token, 'POST', '/inbox-views', { name: `Vista ${i}` })).status, 201);
    }
    assert.equal(errorCode(await fx.call(member.token, 'POST', '/inbox-views', { name: 'Una más' })), 'view_limit');
    // la del owner no cuenta en el tope de Ana
    assert.equal((await fx.call(owner.token, 'POST', '/inbox-views', { name: 'Pago' })).status, 201);

    assert.equal((await fx.call(member.token, 'DELETE', `/inbox-views/${view.id}`)).status, 204);
    assert.equal(((await fx.call(member.token, 'GET', '/inbox-views')).json['views'] as unknown[]).length, INBOX_LIMITS.savedViewsPerUser - 1);
    // aislamiento entre organizaciones
    assert.deepEqual((await fx.call(outsider.token, 'GET', '/inbox-views')).json['views'], []);
  } finally {
    await fx.cleanup();
  }
});
