/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-44): acciones en lote (asignar, cerrar y etiquetar).
 * - Siempre: applyLabelDelta y skipReasonFor.
 * - Con INBOX_BULK_DB_TEST=1: las rutas reales con filas propias, más que las individuales respondan igual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INBOX_LIMITS } from '@gensmart/shared';
import { AppError } from '../middleware/errorHandler';
import { applyLabelDelta, skipReasonFor } from './conversation-actions.service';

test('applyLabelDelta: solo add y remove, sin tocar las demás', () => {
  assert.deepEqual(applyLabelDelta(['a', 'b'], ['c'], ['a']), ['b', 'c']);
  assert.deepEqual(applyLabelDelta(['a'], ['a'], []), ['a']);
  assert.deepEqual(applyLabelDelta([], [], ['x']), []);
});

test('skipReasonFor: el código de la acción individual → motivo', () => {
  assert.equal(skipReasonFor(new AppError(404, 'x', 'NOT_FOUND')), 'not_found');
  assert.equal(skipReasonFor(new AppError(400, 'x', 'ALREADY_CLOSED')), 'already_closed');
  assert.equal(skipReasonFor(new AppError(403, 'x', 'FORBIDDEN')), 'forbidden');
  assert.equal(skipReasonFor(new AppError(400, 'x', 'SAME_USER')), 'same_user');
  assert.equal(skipReasonFor(new AppError(422, 'x', 'conversation_labels_limit')), 'label_limit');
  assert.equal(skipReasonFor(new Error('boom')), 'error');
});

const dbEnabled = process.env['INBOX_BULK_DB_TEST'] === '1';

test('endpoint: asignar, cerrar y etiquetar en lote', { skip: !dbEnabled }, async () => {
  const { startInboxFixture, errorCode } = await import('./inbox-test-fixture');
  const fx = await startInboxFixture('ibulk');
  const spy = await fx.spyEmits();
  try {
    const org = await fx.makeOrg('pro');
    const soloOrg = await fx.makeOrg('solo');
    const other = await fx.makeOrg('pro');
    const owner = await fx.makeUser(org, 'Camila', 'owner');
    const ana = await fx.makeUser(org, 'Ana', 'member');
    const diego = await fx.makeUser(org, 'Diego', 'member');
    const soloOwner = await fx.makeUser(soloOrg, 'Solo', 'owner');
    const agent = await fx.makeAgent(org);
    const otherAgent = await fx.makeAgent(other);
    const soloAgent = await fx.makeAgent(soloOrg);
    const foreign = await fx.makeConversation(other, otherAgent);
    const missing = '00000000-0000-4000-8000-000000000000';

    // ── assign
    const free1 = await fx.makeConversation(org, agent);
    const free2 = await fx.makeConversation(org, agent);
    const anas = await fx.makeConversation(org, agent, { takenBy: ana.id, status: 'human_takeover' });
    const diegos = await fx.makeConversation(org, agent, { takenBy: diego.id, status: 'human_takeover' });

    // un miembro solo asigna las suyas; las demás se saltan
    const byAna = await fx.call(ana.token, 'POST', '/conversations/bulk/assign', { ids: [anas, free1, diegos, foreign, missing], toUserId: diego.id });
    assert.equal(byAna.status, 200, JSON.stringify(byAna.json));
    assert.deepEqual(byAna.json['updated'], [anas]);
    assert.deepEqual(
      byAna.json['skipped'],
      [
        { id: free1, reason: 'forbidden' },
        { id: diegos, reason: 'forbidden' },
        { id: foreign, reason: 'not_found' },
        { id: missing, reason: 'not_found' },
      ]
    );
    // un miembro no puede asignarse a sí mismo
    const self = await fx.call(diego.token, 'POST', '/conversations/bulk/assign', { ids: [diegos], toUserId: diego.id });
    assert.deepEqual(self.json['skipped'], [{ id: diegos, reason: 'same_user' }]);

    await fx.query('DELETE FROM notifications WHERE organization_id = $1', [org]);
    const byOwner = await fx.call(owner.token, 'POST', '/conversations/bulk/assign', {
      ids: [free1, free2, diegos, anas],
      toUserId: ana.id,
      note: 'Son tuyas',
    });
    // el owner, todas (anas la tenía Diego desde la asignación de Ana)
    assert.deepEqual(byOwner.json['updated'], [free1, free2, diegos, anas]);
    // recibir de vuelta una que ya tiene esa persona: same_user
    const again = await fx.call(owner.token, 'POST', '/conversations/bulk/assign', { ids: [free1], toUserId: ana.id });
    assert.deepEqual(again.json['skipped'], [{ id: free1, reason: 'same_user' }]);
    const notifs = await fx.query<{ title: string; message: string }>(
      `SELECT title, message FROM notifications WHERE user_id = $1 AND type = 'conversation_transferred'`,
      [ana.id]
    );
    assert.equal(notifs.rows.length, 1, 'una sola notificación');
    assert.equal(notifs.rows[0]!.title, 'Camila te asignó 4 conversaciones');
    assert.equal(notifs.rows[0]!.message, 'Son tuyas');
    const events = await fx.query<{ count: string }>(`SELECT COUNT(*) AS count FROM conversation_events WHERE organization_id = $1 AND type = 'transferred'`, [org]);
    assert.equal(Number(events.rows[0]!.count), 5, 'un evento por conversación (1 de Ana + 4 del owner)');

    // plan Solo
    const soloConv = await fx.makeConversation(soloOrg, soloAgent);
    assert.equal((await fx.call(soloOwner.token, 'POST', '/conversations/bulk/assign', { ids: [soloConv], toUserId: soloOwner.id })).status, 403);
    // persona de otra organización
    assert.equal(errorCode(await fx.call(owner.token, 'POST', '/conversations/bulk/assign', { ids: [free1], toUserId: soloOwner.id })), 'NOT_A_MEMBER');

    // ── close
    const open1 = await fx.makeConversation(org, agent);
    const closed = await fx.makeConversation(org, agent, { status: 'closed' });
    assert.equal((await fx.call(ana.token, 'POST', '/conversations/bulk/close', { ids: [open1] })).status, 400, 'outcome obligatorio');
    spy.reset();
    const close = await fx.call(ana.token, 'POST', '/conversations/bulk/close', { ids: [open1, closed, foreign], outcome: 'sold' });
    assert.deepEqual(close.json['updated'], [open1]);
    assert.deepEqual(close.json['skipped'], [
      { id: closed, reason: 'already_closed' },
      { id: foreign, reason: 'not_found' },
    ]);
    const closedEv = await fx.query<{ data: { outcome: string } }>(`SELECT data FROM conversation_events WHERE conversation_id = $1 AND type = 'closed'`, [open1]);
    assert.equal(closedEv.rows.length, 1);
    assert.equal(closedEv.rows[0]!.data.outcome, 'sold');
    assert.equal(spy.emits.filter((e) => e.event === 'conversation:update').length, 1);

    // ── labels
    const mk = async (name: string) => (await fx.query<{ id: string }>(`INSERT INTO inbox_labels (organization_id, name) VALUES ($1, $2) RETURNING id`, [org, name])).rows[0]!.id;
    const lKeep = await mk('Queda');
    const lAdd = await mk('Nueva');
    const lDrop = await mk('Se quita');
    const t1 = await fx.makeConversation(org, agent);
    const t2 = await fx.makeConversation(org, agent);
    const t3 = await fx.makeConversation(org, agent); // ya tiene lAdd y no tiene lDrop: no cambia
    await fx.query(`INSERT INTO conversation_labels (conversation_id, label_id, organization_id) VALUES ($1, $3, $5), ($1, $4, $5), ($2, $4, $5), ($6, $7, $5)`, [
      t1, t2, lKeep, lDrop, org, t3, lAdd,
    ]);
    const full = await fx.makeConversation(org, agent);
    const many: string[] = [];
    for (let i = 0; i < INBOX_LIMITS.labelsPerConversation; i++) many.push(await mk(`L${i}`));
    await fx.query(`INSERT INTO conversation_labels (conversation_id, label_id, organization_id) SELECT $1, unnest($2::uuid[]), $3`, [full, many, org]);

    spy.reset();
    const lab = await fx.call(diego.token, 'POST', '/conversations/bulk/labels', { ids: [t1, t2, t3, full, foreign], add: [lAdd], remove: [lDrop] });
    assert.equal(lab.status, 200, JSON.stringify(lab.json));
    assert.deepEqual(lab.json['updated'], [t1, t2, t3]);
    assert.deepEqual(lab.json['skipped'], [
      { id: full, reason: 'label_limit' },
      { id: foreign, reason: 'not_found' },
    ]);
    const t1Labels = await fx.query<{ label_id: string }>('SELECT label_id FROM conversation_labels WHERE conversation_id = $1', [t1]);
    assert.deepEqual(new Set(t1Labels.rows.map((r) => r.label_id)), new Set([lKeep, lAdd]), 'no toca las que no se pidieron');
    const updates = spy.emits.filter((e) => e.event === 'conversation:update').map((e) => e.payload['conversationId']);
    assert.deepEqual(updates, [t1, t2], 'solo emite en las que cambiaron');

    const foreignLabel = (await fx.query<{ id: string }>(`INSERT INTO inbox_labels (organization_id, name) VALUES ($1, 'Ajena') RETURNING id`, [other])).rows[0]!.id;
    assert.equal(errorCode(await fx.call(owner.token, 'POST', '/conversations/bulk/labels', { ids: [t1], add: [foreignLabel], remove: [] })), 'UNKNOWN_LABEL');

    // ── tope para las tres
    const tooMany = Array.from({ length: INBOX_LIMITS.bulkMax + 1 }, () => missing);
    const distinct = tooMany.map((_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    assert.equal((await fx.call(owner.token, 'POST', '/conversations/bulk/close', { ids: distinct, outcome: 'spam' })).status, 400);
    assert.equal((await fx.call(owner.token, 'POST', '/conversations/bulk/assign', { ids: distinct, toUserId: ana.id })).status, 400);
    assert.equal((await fx.call(owner.token, 'POST', '/conversations/bulk/labels', { ids: distinct, add: [lAdd] })).status, 400);
    assert.equal((await fx.call(owner.token, 'POST', '/conversations/bulk/close', { ids: [], outcome: 'spam' })).status, 400);
    assert.equal((await fx.call(owner.token, 'DELETE', '/conversations/bulk', { conversationIds: distinct })).status, 400);
    const okMax = await fx.call(owner.token, 'POST', '/conversations/bulk/close', { ids: distinct.slice(0, INBOX_LIMITS.bulkMax), outcome: 'spam' });
    assert.equal(okMax.status, 200);
    assert.equal((okMax.json['skipped'] as unknown[]).length, INBOX_LIMITS.bulkMax);

    // ── las rutas individuales responden igual que antes
    const single = await fx.makeConversation(org, agent);
    const tr = await fx.call(owner.token, 'POST', `/conversations/${single}/transfer`, { toUserId: ana.id });
    assert.equal(tr.status, 200);
    assert.equal(tr.json['message'], 'Conversation transferred');
    assert.equal(tr.json['takenOverBy'], ana.id);
    assert.equal(errorCode(await fx.call(diego.token, 'POST', `/conversations/${single}/transfer`, { toUserId: diego.id })), 'FORBIDDEN');
    assert.equal(errorCode(await fx.call(owner.token, 'POST', `/conversations/${single}/transfer`, { toUserId: ana.id })), 'SAME_USER');
    const cl = await fx.call(owner.token, 'PUT', `/conversations/${single}/close`, { outcome: 'resolved' });
    assert.equal(cl.status, 200);
    assert.equal(cl.json['message'], 'Conversation closed');
    assert.equal(cl.json['outcome'], 'resolved');
    assert.equal(errorCode(await fx.call(owner.token, 'PUT', `/conversations/${single}/close`, {})), 'ALREADY_CLOSED');
    assert.equal((await fx.call(owner.token, 'PUT', `/conversations/${missing}/close`, {})).status, 404);
    const put = await fx.call(owner.token, 'PUT', `/conversations/${single}/labels`, { labelIds: [lKeep] });
    assert.deepEqual(put.json['labels'], [{ id: lKeep, name: 'Queda' }]);
  } finally {
    await fx.cleanup();
  }
});
