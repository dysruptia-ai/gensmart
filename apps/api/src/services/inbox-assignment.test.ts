/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-45): reparto automático.
 * - Siempre: pickAssignee (la elección, pura).
 * - Con INBOX_ASSIGNMENT_DB_TEST=1: autoAssign/assignPending con filas propias y una presencia de prueba.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickAssignee } from './inbox-assignment.service';

test('pickAssignee: última persona → responsable del agente → rotativo', () => {
  const c = [
    { userId: 'b', lastAssignedAt: '2026-11-27T10:00:00Z' },
    { userId: 'a', lastAssignedAt: null },
    { userId: 'c', lastAssignedAt: '2026-11-27T09:00:00Z' },
  ];
  assert.deepEqual(pickAssignee(c, { keepLastUserId: 'b', agentAssigneeId: 'c', mode: 'agent' }), { userId: 'b', mode: 'keep_last' });
  assert.deepEqual(pickAssignee(c, { keepLastUserId: 'x', agentAssigneeId: 'c', mode: 'agent' }), { userId: 'c', mode: 'agent' });
  // por agente sin responsable disponible: rotativo
  assert.deepEqual(pickAssignee(c, { keepLastUserId: null, agentAssigneeId: 'x', mode: 'agent' }), { userId: 'a', mode: 'rotating' });
  // el responsable no cuenta en rotativo
  assert.deepEqual(pickAssignee(c, { keepLastUserId: null, agentAssigneeId: 'c', mode: 'rotating' }), { userId: 'a', mode: 'rotating' });
  const allSet = c.filter((x) => x.userId !== 'a');
  assert.equal(pickAssignee(allSet, { keepLastUserId: null, agentAssigneeId: null, mode: 'rotating' })?.userId, 'c');
  // desempate por user_id
  assert.equal(
    pickAssignee([{ userId: 'z', lastAssignedAt: null }, { userId: 'm', lastAssignedAt: null }], { keepLastUserId: null, agentAssigneeId: null, mode: 'rotating' })?.userId,
    'm'
  );
  assert.equal(pickAssignee([], { keepLastUserId: 'a', agentAssigneeId: null, mode: 'rotating' }), null);
});

const dbEnabled = process.env['INBOX_ASSIGNMENT_DB_TEST'] === '1';

test('autoAssign y assignPending con la base', { skip: !dbEnabled }, async () => {
  const { startInboxFixture } = await import('./inbox-test-fixture');
  const { setPresenceProvider } = await import('./presence.service');
  const { autoAssign, assignPending } = await import('./inbox-assignment.service');
  const { markHandoffRequested } = await import('./conversation-events.service');
  const { releaseToAgent } = await import('./conversation-actions.service');
  const fx = await startInboxFixture('iassign');
  await fx.spyEmits();
  const online = new Set<string>();
  setPresenceProvider({
    isOnline: async (_o, u) => online.has(u),
    onlineUsers: async () => [...online],
  });
  try {
    const org = await fx.makeOrg('pro');
    const soloOrg = await fx.makeOrg('solo');
    const owner = await fx.makeUser(org, 'Camila', 'owner');
    const ana = await fx.makeUser(org, 'Ana', 'member');
    const diego = await fx.makeUser(org, 'Diego', 'member');
    const agent = await fx.makeAgent(org, 'Ventas');
    const agent2 = await fx.makeAgent(org, 'Soporte');

    const help = async (agentId = agent, contactId?: string) => {
      const id = await fx.makeConversation(org, agentId, contactId ? { contactId } : {});
      await fx.query('UPDATE conversations SET handed_off_at = NOW() WHERE id = $1', [id]);
      return id;
    };
    const holderOf = async (id: string) =>
      (await fx.query<{ taken_over_by: string | null; status: string }>('SELECT taken_over_by, status FROM conversations WHERE id = $1', [id])).rows[0]!;
    const setSettings = (mode: string, keep = false) =>
      fx.query(
        `INSERT INTO inbox_settings (organization_id, assignment_mode, keep_last_person) VALUES ($1, $2, $3)
         ON CONFLICT (organization_id) DO UPDATE SET assignment_mode = EXCLUDED.assignment_mode, keep_last_person = EXCLUDED.keep_last_person`,
        [org, mode, keep]
      );
    const member = (userId: string, capacity: number, receives = true) =>
      fx.query(
        `INSERT INTO inbox_member_settings (organization_id, user_id, capacity, receives) VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, user_id) DO UPDATE SET capacity = EXCLUDED.capacity, receives = EXCLUDED.receives`,
        [org, userId, capacity, receives]
      );
    const freeAll = () => fx.query(`UPDATE conversations SET status = 'closed' WHERE organization_id = $1`, [org]);

    // ── none (sin fila) no hace nada
    online.add(ana.id);
    const c0 = await help();
    assert.equal(await autoAssign(c0), null);
    assert.equal((await holderOf(c0)).taken_over_by, null);

    // ── Solo nunca
    await fx.query(`INSERT INTO inbox_settings (organization_id, assignment_mode) VALUES ($1, 'rotating')`, [soloOrg]);
    const soloUser = await fx.makeUser(soloOrg, 'Solo', 'owner');
    online.add(soloUser.id);
    const soloAgent = await fx.makeAgent(soloOrg);
    const soloConv = await fx.makeConversation(soloOrg, soloAgent);
    await fx.query('UPDATE conversations SET handed_off_at = NOW() WHERE id = $1', [soloConv]);
    assert.equal(await autoAssign(soloConv), null);

    // ── rotativo: solo quien está en línea; nunca asignado primero; el evento y la notificación
    await setSettings('rotating');
    await member(owner.id, 8, false); // el owner no recibe
    const c1 = await help();
    assert.equal(await autoAssign(c1), ana.id); // Diego está desconectado
    const h1 = await holderOf(c1);
    assert.equal(h1.status, 'human_takeover');
    const ev = await fx.query<{ type: string; actor_user_id: string | null; target_user_id: string; data: { mode: string } }>(
      `SELECT type, actor_user_id, target_user_id, data FROM conversation_events WHERE conversation_id = $1 AND type = 'assigned'`,
      [c1]
    );
    assert.equal(ev.rows.length, 1);
    assert.equal(ev.rows[0]!.actor_user_id, null);
    assert.equal(ev.rows[0]!.target_user_id, ana.id);
    assert.equal(ev.rows[0]!.data.mode, 'rotating');
    const notif = await fx.query<{ title: string }>(
      `SELECT title FROM notifications WHERE user_id = $1 AND type = 'conversation_assigned' AND data->>'conversationId' = $2`,
      [ana.id, c1]
    );
    assert.equal(notif.rows[0]?.title, 'Se te asignó una conversación'); // en su idioma (es)
    // ya tiene dueño: no se asigna otra vez
    assert.equal(await autoAssign(c1), null);

    online.add(diego.id);
    const c2 = await help();
    assert.equal(await autoAssign(c2), diego.id); // Diego nunca recibió: va primero
    const c3 = await help();
    assert.equal(await autoAssign(c3), ana.id); // la de last_assigned_at más antiguo

    // ── cupo y "lleno"; receives = false
    await freeAll();
    await member(ana.id, 1);
    await member(diego.id, 8, false);
    const c4 = await help();
    assert.equal(await autoAssign(c4), ana.id);
    const c5 = await help();
    assert.equal(await autoAssign(c5), null); // Ana llena, Diego no recibe, owner no recibe
    assert.equal((await holderOf(c5)).taken_over_by, null);

    // ── sin nadie disponible queda sin dueño y assignPending la reparte después
    await member(diego.id, 8, true);
    assert.equal(await assignPending(org, [c5]), 1);
    assert.equal((await holderOf(c5)).taken_over_by, diego.id);

    // ── por agente: el responsable, si puede recibirla
    await freeAll();
    await member(ana.id, 8);
    await setSettings('agent');
    await fx.query(`INSERT INTO inbox_agent_assignees (agent_id, organization_id, user_id) VALUES ($1, $2, $3)`, [agent2, org, diego.id]);
    await fx.query(`UPDATE inbox_member_settings SET last_assigned_at = NULL WHERE organization_id = $1`, [org]);
    const c6 = await help(agent2);
    assert.equal(await autoAssign(c6), diego.id);
    const c7 = await help(agent2);
    assert.equal(await autoAssign(c7), diego.id); // el responsable, aunque acaba de recibir
    online.delete(diego.id);
    const c8 = await help(agent2);
    assert.equal(await autoAssign(c8), ana.id); // responsable desconectado → rotativo
    online.add(diego.id);

    // ── mantener con la última persona (en cualquier conversación del contacto)
    await freeAll();
    await setSettings('rotating', true);
    const contact = await fx.query<{ id: string }>(`INSERT INTO contacts (organization_id, agent_id, name) VALUES ($1, $2, 'Leal') RETURNING id`, [org, agent]);
    const old = await fx.makeConversation(org, agent, { contactId: contact.rows[0]!.id });
    await fx.query(
      `INSERT INTO messages (conversation_id, role, content, metadata) VALUES ($1, 'human', 'hola', $2)`,
      [old, JSON.stringify({ sentBy: { id: diego.id, name: 'Diego' } })]
    );
    await fx.query(`UPDATE inbox_member_settings SET last_assigned_at = NOW() WHERE user_id = $1`, [diego.id]);
    const c9 = await help(agent, contact.rows[0]!.id);
    assert.equal(await autoAssign(c9), diego.id);
    const kev = await fx.query<{ data: { mode: string } }>(`SELECT data FROM conversation_events WHERE conversation_id = $1 AND type = 'assigned'`, [c9]);
    assert.equal(kev.rows[0]!.data.mode, 'keep_last');

    // ── dos autoAssign simultáneos no pasan el cupo
    await freeAll();
    await setSettings('rotating');
    await member(ana.id, 1);
    await member(diego.id, 1, false);
    const p1 = await help();
    const p2 = await help();
    const p3 = await help();
    const results = await Promise.all([autoAssign(p1), autoAssign(p2), autoAssign(p3), autoAssign(p1)]);
    assert.equal(results.filter((r) => r === ana.id).length, 1, JSON.stringify(results));
    const anaOpen = await fx.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM conversations WHERE taken_over_by = $1 AND status = 'human_takeover'`,
      [ana.id]
    );
    assert.equal(anaOpen.rows[0]!.n, '1');

    // ── devolver al agente no dispara el reparto de esa conversación
    await member(diego.id, 8, true);
    const taken = (await fx.query<{ id: string }>(`SELECT id FROM conversations WHERE taken_over_by = $1 AND status = 'human_takeover'`, [ana.id])).rows[0]!.id;
    await fx.query(`UPDATE conversations SET handoff_attended_at = NOW() WHERE id = $1`, [taken]);
    await releaseToAgent({ id: taken, organization_id: org, taken_over_at: null }, ana.id);
    await new Promise((r) => setTimeout(r, 300)); // onCapacityFreed corre en segundo plano
    assert.equal((await holderOf(taken)).taken_over_by, null);
    assert.equal((await holderOf(taken)).status, 'active');

    // ── markHandoffRequested deja el pedido y reparte
    await freeAll();
    const viaMark = await fx.makeConversation(org, agent);
    await markHandoffRequested(viaMark, { organizationId: org, reason: 'agent_paused' });
    assert.notEqual((await holderOf(viaMark)).taken_over_by, null);
  } finally {
    setPresenceProvider(null);
    await fx.cleanup();
  }
});
