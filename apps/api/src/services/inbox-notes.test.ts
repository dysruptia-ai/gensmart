/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-43): notas internas.
 * - Siempre: que ningún camino del agente lea conversation_notes.
 * - Con INBOX_NOTES_DB_TEST=1 (Postgres local): los endpoints reales con datos propios que se borran al final.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('el agente, el scoring y el resumen nunca leen conversation_notes', () => {
  const workers = path.resolve(__dirname, '../workers');
  for (const file of fs.readdirSync(workers)) {
    if (file === 'export.worker.ts') continue; // la exportación de datos sí las incluye (es del cliente)
    const src = fs.readFileSync(path.join(workers, file), 'utf8');
    assert.ok(!src.includes('conversation_notes'), `${file} no debe leer conversation_notes`);
  }
  for (const file of fs.readdirSync(__dirname)) {
    if (!file.endsWith('.ts') || file.includes('.test.') || file === 'inbox-annotations.service.ts' || file === 'inbox-test-fixture.ts') continue;
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(!src.includes('conversation_notes'), `${file} no debe leer conversation_notes`);
  }
});

const dbEnabled = process.env['INBOX_NOTES_DB_TEST'] === '1';

test('notas: crear, borrar con permisos, evento sin texto y aislamiento', { skip: !dbEnabled }, async () => {
  const { startInboxFixture, errorCode } = await import('./inbox-test-fixture');
  const f = await startInboxFixture('notes');
  try {
    const orgId = await f.makeOrg('free');
    const owner = await f.makeUser(orgId, 'Olga', 'owner');
    const admin = await f.makeUser(orgId, 'Adan', 'admin');
    const ana = await f.makeUser(orgId, 'Ana', 'member');
    const beto = await f.makeUser(orgId, 'Beto', 'member');
    const otherOrg = await f.makeOrg('pro');
    const stranger = await f.makeUser(otherOrg, 'Extra', 'owner');
    const agentId = await f.makeAgent(orgId);
    // Tomada por Ana con el último mensaje del cliente: está en "Necesitan"
    const c1 = await f.makeConversation(orgId, agentId, { takenBy: ana.id, status: 'human_takeover' });
    const snapshot = async () =>
      (await f.query<{ last_message_at: string; message_count: number; updated_at: string }>(
        'SELECT last_message_at, message_count, updated_at FROM conversations WHERE id = $1',
        [c1]
      )).rows[0];
    const needsIds = async () =>
      ((await f.call(ana.token, 'GET', '/conversations?view=needs&range=all')).json['conversations'] as Array<{ id: string; lastMessage: { content: string } | null }>);
    const before = await snapshot();
    assert.ok((await needsIds()).some((c) => c.id === c1), 'antes está en Necesitan');

    // Validación
    assert.equal((await f.call(ana.token, 'POST', `/conversations/${c1}/notes`, { body: '   ' })).status, 400);
    assert.equal((await f.call(ana.token, 'POST', `/conversations/${c1}/notes`, { body: 'x'.repeat(2001) })).status, 400);
    assert.equal((await f.call(ana.token, 'POST', `/conversations/${c1}/notes`, { body: 'x'.repeat(2000) })).status, 201);

    // Beto (member, no la tiene) también puede escribir notas; plan free incluido
    const n1 = await f.call(ana.token, 'POST', `/conversations/${c1}/notes`, { body: 'Cliente pidió factura\na nombre de la empresa' });
    assert.equal(n1.status, 201);
    const note1 = n1.json['note'] as { id: string; body: string; authorName: string; canDelete: boolean };
    assert.equal(note1.authorName, 'Ana');
    assert.equal(note1.canDelete, true);
    const n2 = await f.call(beto.token, 'POST', `/conversations/${c1}/notes`, { body: 'Nota de Beto' });
    assert.equal(n2.status, 201);
    const note2 = (n2.json['note'] as { id: string }).id;

    // No cambia la conversación ni "Necesitan" ni el preview de la fila
    assert.deepEqual(await snapshot(), before);
    const needs = await needsIds();
    const row = needs.find((c) => c.id === c1);
    assert.ok(row, 'sigue en Necesitan');
    assert.equal(row.lastMessage?.content, 'hola');

    // Detalle: canDelete depende de quién mira
    const detailAna = await f.call(ana.token, 'GET', `/conversations/${c1}`);
    const notesAna = detailAna.json['notes'] as Array<{ id: string; canDelete: boolean }>;
    assert.equal(notesAna.length, 3);
    assert.deepEqual(notesAna.map((n) => n.canDelete), [true, true, false]);
    const detailOwner = await f.call(owner.token, 'GET', `/conversations/${c1}`);
    assert.ok((detailOwner.json['notes'] as Array<{ canDelete: boolean }>).every((n) => n.canDelete));

    // Borrar: otro miembro 403, el autor sí, owner/admin sí
    assert.equal((await f.call(beto.token, 'DELETE', `/conversations/${c1}/notes/${note1.id}`)).status, 403);
    const del = await f.call(ana.token, 'DELETE', `/conversations/${c1}/notes/${note1.id}`);
    assert.equal(del.status, 200);
    assert.equal((del.json['event'] as { type: string }).type, 'note_deleted');
    assert.equal((await f.call(ana.token, 'DELETE', `/conversations/${c1}/notes/${note1.id}`)).status, 404);
    assert.equal((await f.call(admin.token, 'DELETE', `/conversations/${c1}/notes/${note2}`)).status, 200);

    // La borrada no vuelve; el evento queda sin el texto
    const after = await f.call(owner.token, 'GET', `/conversations/${c1}`);
    const ids = (after.json['notes'] as Array<{ id: string }>).map((n) => n.id);
    assert.ok(!ids.includes(note1.id) && !ids.includes(note2));
    const evs = (after.json['events'] as Array<{ type: string; actorName: string; data: Record<string, unknown> }>).filter((e) => e.type === 'note_deleted');
    assert.equal(evs.length, 2);
    assert.deepEqual(evs[0]!.data, { noteId: note1.id });
    assert.equal(evs[0]!.actorName, 'Ana');
    assert.ok(!JSON.stringify(evs).includes('factura'));
    const raw = await f.query<{ deleted_by: string }>('SELECT deleted_by FROM conversation_notes WHERE id = $1', [note1.id]);
    assert.equal(raw.rows[0]!.deleted_by, ana.id);

    // Cerrada: también admite notas
    const closed = await f.makeConversation(orgId, agentId, { status: 'closed' });
    assert.equal((await f.call(beto.token, 'POST', `/conversations/${closed}/notes`, { body: 'Después del cierre' })).status, 201);

    // Aislamiento: alguien de otra organización no ve, no escribe ni borra
    const n3 = (await f.call(owner.token, 'POST', `/conversations/${c1}/notes`, { body: 'Privada' })).json['note'] as { id: string };
    assert.equal((await f.call(stranger.token, 'GET', `/conversations/${c1}`)).status, 404);
    const foreign = await f.call(stranger.token, 'POST', `/conversations/${c1}/notes`, { body: 'Intruso' });
    assert.equal(foreign.status, 404);
    assert.equal(errorCode(foreign), 'NOT_FOUND');
    assert.equal((await f.call(stranger.token, 'DELETE', `/conversations/${c1}/notes/${n3.id}`)).status, 404);

    // Borrar la conversación borra sus notas
    await f.query('DELETE FROM messages WHERE conversation_id = $1', [closed]);
    await f.query('DELETE FROM conversations WHERE id = $1', [closed]);
    const left = await f.query('SELECT 1 FROM conversation_notes WHERE conversation_id = $1', [closed]);
    assert.equal(left.rows.length, 0);
  } finally {
    await f.cleanup();
  }
});
