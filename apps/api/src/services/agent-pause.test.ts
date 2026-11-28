/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-45): pausar un agente.
 * Con AGENT_PAUSE_DB_TEST=1: la ruta (roles y plan) y el worker con el agente pausado (sin LLM, deja el
 * pedido de ayuda con reason 'agent_paused' y reparte; las tomadas no cambian).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Job } from 'bullmq';

const dbEnabled = process.env['AGENT_PAUSE_DB_TEST'] === '1';

test('pausar un agente: ruta y worker', { skip: !dbEnabled }, async () => {
  const { startInboxFixture, errorCode } = await import('./inbox-test-fixture');
  const { setPresenceProvider } = await import('./presence.service');
  const { redis } = await import('../config/redis');
  const { processMessageForTests } = await import('../workers/message.worker');
  const fx = await startInboxFixture('ipause');
  const spy = await fx.spyEmits();
  const online = new Set<string>();
  setPresenceProvider({ isOnline: async (_o, u) => online.has(u), onlineUsers: async () => [...online] });
  try {
    const org = await fx.makeOrg('pro');
    const soloOrg = await fx.makeOrg('solo');
    const owner = await fx.makeUser(org, 'Camila', 'owner');
    const admin = await fx.makeUser(org, 'Andrés', 'admin');
    const ana = await fx.makeUser(org, 'Ana', 'member');
    const soloOwner = await fx.makeUser(soloOrg, 'Solo', 'owner');
    const agent = await fx.makeAgent(org, 'Ventas');
    const soloAgent = await fx.makeAgent(soloOrg);

    // ── ruta: solo owner y admin; Solo da 403
    assert.equal((await fx.call(ana.token, 'PATCH', `/agents/${agent}/inbox-pause`, { paused: true })).status, 403);
    const solo = await fx.call(soloOwner.token, 'PATCH', `/agents/${soloAgent}/inbox-pause`, { paused: true });
    assert.equal(solo.status, 403);
    assert.equal(errorCode(solo), 'PLAN_LIMIT');
    assert.equal((await fx.call(owner.token, 'PATCH', `/agents/${agent}/inbox-pause`, { paused: 'yes' })).status, 400);
    spy.reset();
    const paused = await fx.call(admin.token, 'PATCH', `/agents/${agent}/inbox-pause`, { paused: true });
    assert.equal(paused.status, 200);
    assert.ok(paused.json['inboxPausedAt']);
    assert.equal(paused.json['inboxPausedByName'], 'Andrés');
    assert.ok(spy.emits.some((e) => e.event === 'agent:update' && e.rooms.includes(`org:${org}`)));
    const list = await fx.call(ana.token, 'GET', '/agents');
    const listed = (list.json['agents'] as Array<Record<string, unknown>>).find((a) => a['id'] === agent)!;
    assert.equal(listed['inboxPausedByName'], 'Andrés');
    // el agente sigue publicado (no toca status)
    const st = await fx.query<{ status: string }>('SELECT status FROM agents WHERE id = $1', [agent]);
    assert.notEqual(st.rows[0]!.status, 'paused');

    // ── worker: el agente pausado no responde, deja el pedido y reparte
    await fx.query(`INSERT INTO inbox_settings (organization_id, assignment_mode) VALUES ($1, 'rotating')`, [org]);
    online.add(ana.id);
    const conv = await fx.makeConversation(org, agent);
    const run = async (conversationId: string, text: string) => {
      await redis.rpush(`buffer:${conversationId}`, JSON.stringify({ type: 'text', content: text, receivedAt: Date.now() }));
      await processMessageForTests({ data: { conversationId, agentId: agent, organizationId: org } } as unknown as Job<{
        conversationId: string;
        agentId: string;
        organizationId: string;
      }>);
    };
    await run(conv, '¿Tienen envío?');
    const msgs = await fx.query<{ role: string; content: string }>('SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at', [conv]);
    assert.deepEqual(msgs.rows.map((m) => m.role), ['user', 'user']); // sin respuesta del agente (ni LLM)
    assert.equal(msgs.rows[1]!.content, '¿Tienen envío?');
    const ev = await fx.query<{ data: { reason?: string } }>(
      `SELECT data FROM conversation_events WHERE conversation_id = $1 AND type = 'handoff_requested'`,
      [conv]
    );
    assert.equal(ev.rows.length, 1);
    assert.equal(ev.rows[0]!.data.reason, 'agent_paused');
    const after = await fx.query<{ taken_over_by: string | null; handed_off_at: string | null }>(
      'SELECT taken_over_by, handed_off_at FROM conversations WHERE id = $1',
      [conv]
    );
    assert.ok(after.rows[0]!.handed_off_at);
    assert.equal(after.rows[0]!.taken_over_by, ana.id); // repartida

    // ── un segundo mensaje con el pedido vigente no deja otro pedido
    const conv2 = await fx.makeConversation(org, agent);
    online.clear();
    await run(conv2, 'hola');
    await run(conv2, '¿hay alguien?');
    const ev2 = await fx.query(`SELECT 1 FROM conversation_events WHERE conversation_id = $1 AND type = 'handoff_requested'`, [conv2]);
    assert.equal(ev2.rows.length, 1);

    // ── las tomadas no cambian
    const taken = await fx.makeConversation(org, agent, { takenBy: owner.id, status: 'human_takeover' });
    await run(taken, 'gracias');
    const t = await fx.query<{ taken_over_by: string; status: string }>('SELECT taken_over_by, status FROM conversations WHERE id = $1', [taken]);
    assert.equal(t.rows[0]!.taken_over_by, owner.id);
    assert.equal(t.rows[0]!.status, 'human_takeover');
    const tev = await fx.query(`SELECT 1 FROM conversation_events WHERE conversation_id = $1 AND type = 'handoff_requested'`, [taken]);
    assert.equal(tev.rows.length, 0);

    // ── reactivar
    const resumed = await fx.call(owner.token, 'PATCH', `/agents/${agent}/inbox-pause`, { paused: false });
    assert.equal(resumed.json['inboxPausedAt'], null);
  } finally {
    setPresenceProvider(null);
    await fx.cleanup();
  }
});
