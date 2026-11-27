/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-44): leído y no leído por persona.
 * Con INBOX_UNREAD_DB_TEST=1: la regla UNREAD_SQL en la lista, /read, /unread, unreadCount y order=unread.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const dbEnabled = process.env['INBOX_UNREAD_DB_TEST'] === '1';

test('endpoint: no leídas por persona', { skip: !dbEnabled }, async () => {
  const { startInboxFixture } = await import('./inbox-test-fixture');
  const fx = await startInboxFixture('iunread');
  const spy = await fx.spyEmits();
  try {
    const org = await fx.makeOrg('pro');
    const pro = await fx.makeUser(org, 'Pro', 'owner');
    const ana = await fx.makeUser(org, 'Ana', 'member');
    const agent = await fx.makeAgent(org);
    // punto de partida: hace 1 hora para los dos
    await fx.query(`UPDATE user_organizations SET inbox_read_since = NOW() - interval '1 hour' WHERE organization_id = $1`, [org]);

    const msg = (conv: string, role: string, minutesAgo: number) =>
      fx.query(`INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, $2, 'x', NOW() - make_interval(mins => $3))`, [conv, role, minutesAgo]);

    // makeConversation deja un mensaje del cliente hace 10 minutos (posterior al punto de partida)
    const fresh = await fx.makeConversation(org, agent);
    const old = await fx.makeConversation(org, agent);
    await fx.query(`DELETE FROM messages WHERE conversation_id = $1`, [old]);
    await msg(old, 'user', 120); // antes de inbox_read_since: leída
    const agentAfter = await fx.makeConversation(org, agent);
    const teamAfter = await fx.makeConversation(org, agent);
    const sysAfter = await fx.makeConversation(org, agent);
    for (const id of [agentAfter, teamAfter, sysAfter]) {
      await fx.query(`INSERT INTO conversation_reads (conversation_id, user_id, organization_id, last_read_at) VALUES ($1, $2, $3, NOW() - interval '5 minutes')`, [id, pro.id, org]);
    }
    await msg(agentAfter, 'assistant', 1);
    await msg(teamAfter, 'human', 1);
    await msg(sysAfter, 'system', 1);

    type Row = { id: string; unread: boolean };
    const list = async (token: string, qs = '') => {
      const r = await fx.call(token, 'GET', `/conversations?view=all&limit=100${qs}`);
      assert.equal(r.status, 200, JSON.stringify(r.json));
      return { rows: r.json['conversations'] as Row[], unreadCount: r.json['unreadCount'] as number };
    };
    const unreadOf = (rows: Row[]) => new Map(rows.map((r) => [r.id, r.unread]));

    let p = unreadOf((await list(pro.token)).rows);
    assert.equal(p.get(fresh), true, 'mensaje del cliente posterior');
    assert.equal(p.get(old), false, 'anterior a inbox_read_since');
    assert.equal(p.get(agentAfter), false, 'del agente no');
    assert.equal(p.get(teamAfter), false, 'del equipo no');
    assert.equal(p.get(sysAfter), false, 'del sistema no');

    // un mensaje del cliente después de leerla la vuelve no leída
    await msg(agentAfter, 'user', 0);
    p = unreadOf((await list(pro.token)).rows);
    assert.equal(p.get(agentAfter), true);

    // /read y /unread, solo para esa persona, emitidos solo a su sala
    spy.reset();
    assert.equal((await fx.call(pro.token, 'POST', `/conversations/${fresh}/read`)).status, 200);
    assert.equal((await fx.call(pro.token, 'POST', `/conversations/${fresh}/read`)).status, 200, 'idempotente');
    const rs = spy.emits.filter((e) => e.event === 'conversation:read-state');
    assert.equal(rs.length, 2);
    assert.ok(rs.every((e) => e.rooms.length === 1 && e.rooms[0] === `user:${pro.id}`), 'nunca a org:');
    assert.deepEqual(rs[0]!.payload['unread'], false);

    p = unreadOf((await list(pro.token)).rows);
    assert.equal(p.get(fresh), false);
    const a = unreadOf((await list(ana.token)).rows);
    assert.equal(a.get(fresh), true, 'Ana la sigue viendo sin leer');

    assert.equal((await fx.call(pro.token, 'POST', `/conversations/${old}/unread`)).status, 200);
    p = unreadOf((await list(pro.token)).rows);
    assert.equal(p.get(old), true, 'marcada como no leída');
    const kept = await fx.query<{ last_read_at: string | null }>('SELECT last_read_at FROM conversation_reads WHERE conversation_id = $1 AND user_id = $2', [old, pro.id]);
    assert.ok(kept.rows[0]);
    const ev = await fx.query<{ count: string }>('SELECT COUNT(*) AS count FROM conversation_events WHERE conversation_id = $1', [old]);
    assert.equal(Number(ev.rows[0]!.count), 0, 'no deja evento');

    // unreadCount y order=unread
    const withCount = await list(pro.token, '&order=unread');
    assert.equal(withCount.unreadCount, 2); // agentAfter y old
    assert.deepEqual(new Set(withCount.rows.slice(0, 2).map((r) => r.id)), new Set([agentAfter, old]));
    assert.ok(withCount.rows.slice(2).every((r) => !r.unread));

    // /read de una conversación ajena o inexistente: 404
    assert.equal((await fx.call(pro.token, 'POST', '/conversations/00000000-0000-4000-8000-000000000000/read')).status, 404);
  } finally {
    await fx.cleanup();
  }
});
