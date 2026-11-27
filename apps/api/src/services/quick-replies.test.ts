/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-43): respuestas rápidas.
 * - Siempre: el formato del atajo.
 * - Con QUICK_REPLIES_DB_TEST=1 (Postgres local): CRUD con roles, duplicados, tope y /use.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INBOX_LIMITS, QUICK_REPLY_SHORTCUT_RE } from '@gensmart/shared';
import { normalizeShortcut } from './inbox-annotations.service';

test('formato del atajo', () => {
  for (const ok of ['pago', 'garantía', 'pasos-pse', 'envio_24h', '24h', 'ñandú']) assert.ok(QUICK_REPLY_SHORTCUT_RE.test(ok), ok);
  for (const bad of ['p', 'Pago', 'con espacio', '-pago', '_x', 'a'.repeat(31), 'pago!', '']) assert.ok(!QUICK_REPLY_SHORTCUT_RE.test(bad), bad);
  assert.equal(normalizeShortcut(' /Garantía '), 'garantía');
});

const dbEnabled = process.env['QUICK_REPLIES_DB_TEST'] === '1';

test('respuestas rápidas: CRUD, roles, duplicados, tope y /use', { skip: !dbEnabled }, async () => {
  const { startInboxFixture, errorCode } = await import('./inbox-test-fixture');
  const f = await startInboxFixture('qr');
  try {
    const orgId = await f.makeOrg();
    const owner = await f.makeUser(orgId, 'Olga', 'owner');
    const admin = await f.makeUser(orgId, 'Adan', 'admin');
    const ana = await f.makeUser(orgId, 'Ana', 'member');
    const otherOrg = await f.makeOrg();
    const stranger = await f.makeUser(otherOrg, 'Extra', 'owner');

    // Miembros no crean
    assert.equal((await f.call(ana.token, 'POST', '/quick-replies', { shortcut: 'pago', body: 'x' })).status, 403);
    const created = await f.call(owner.token, 'POST', '/quick-replies', { shortcut: '/Pago', body: 'Hola {nombre}, puedes pagar…' });
    assert.equal(created.status, 201);
    const pago = created.json['quickReply'] as { id: string; shortcut: string; useCount: number };
    assert.equal(pago.shortcut, 'pago');
    // Con tildes
    const gar = await f.call(admin.token, 'POST', '/quick-replies', { shortcut: 'garantía', body: 'Cubre 12 meses, {nombre}.' });
    assert.equal(gar.status, 201);
    const garId = (gar.json['quickReply'] as { id: string }).id;
    // Formato inválido y texto vacío o largo
    assert.equal((await f.call(owner.token, 'POST', '/quick-replies', { shortcut: 'con espacio', body: 'x' })).status, 400);
    assert.equal((await f.call(owner.token, 'POST', '/quick-replies', { shortcut: 'vacio', body: '  ' })).status, 400);
    assert.equal((await f.call(owner.token, 'POST', '/quick-replies', { shortcut: 'largo', body: 'x'.repeat(1001) })).status, 400);
    // Duplicado sin distinguir mayúsculas
    const dup = await f.call(owner.token, 'POST', '/quick-replies', { shortcut: 'PAGO', body: 'otra' });
    assert.equal(dup.status, 409);
    assert.equal(errorCode(dup), 'shortcut_taken');
    assert.equal(errorCode(await f.call(owner.token, 'PATCH', `/quick-replies/${garId}`, { shortcut: 'pago' })), 'shortcut_taken');
    // Otra organización puede tener el mismo atajo y no ve las ajenas
    assert.equal((await f.call(stranger.token, 'POST', '/quick-replies', { shortcut: 'pago', body: 'suya' })).status, 201);
    const strangerList = (await f.call(stranger.token, 'GET', '/quick-replies')).json['quickReplies'] as unknown[];
    assert.equal(strangerList.length, 1);
    assert.equal((await f.call(stranger.token, 'PATCH', `/quick-replies/${pago.id}`, { body: 'hack' })).status, 404);

    // Editar: miembros no
    assert.equal((await f.call(ana.token, 'PATCH', `/quick-replies/${pago.id}`, { body: 'x' })).status, 403);
    const edited = await f.call(admin.token, 'PATCH', `/quick-replies/${pago.id}`, { body: 'Hola {nombre}, puedes pagar con PSE.' });
    assert.equal(edited.status, 200);
    assert.equal((edited.json['quickReply'] as { body: string }).body, 'Hola {nombre}, puedes pagar con PSE.');

    // /use: cualquier rol; el orden de la lista sigue los usos
    assert.equal((await f.call(ana.token, 'POST', `/quick-replies/${garId}/use`)).status, 200);
    const used = await f.call(ana.token, 'POST', `/quick-replies/${garId}/use`);
    assert.equal(used.json['useCount'], 2);
    assert.equal((await f.call(stranger.token, 'POST', `/quick-replies/${garId}/use`)).status, 404);
    const list = (await f.call(ana.token, 'GET', '/quick-replies')).json['quickReplies'] as Array<{ shortcut: string; lastUsedAt: string | null }>;
    assert.deepEqual(list.map((q) => q.shortcut), ['garantía', 'pago']);
    assert.ok(list[0]!.lastUsedAt);

    // Tope por organización
    await f.query(
      `INSERT INTO quick_replies (organization_id, shortcut, body)
       SELECT $1, 'tope' || g, 'x' FROM generate_series(1, $2::int) g`,
      [orgId, INBOX_LIMITS.quickRepliesPerOrg - 2]
    );
    const over = await f.call(owner.token, 'POST', '/quick-replies', { shortcut: 'una-mas', body: 'x' });
    assert.equal(over.status, 422);
    assert.equal(errorCode(over), 'quick_replies_limit');

    // Borrar: miembros no
    assert.equal((await f.call(ana.token, 'DELETE', `/quick-replies/${pago.id}`)).status, 403);
    assert.equal((await f.call(owner.token, 'DELETE', `/quick-replies/${pago.id}`)).status, 204);
    assert.equal((await f.call(owner.token, 'DELETE', `/quick-replies/${pago.id}`)).status, 404);
  } finally {
    await f.cleanup();
  }
});
