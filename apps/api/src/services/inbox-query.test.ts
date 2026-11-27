/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-41): filtros de GET /api/conversations y GET /api/conversations/counts.
 * - Siempre: las condiciones parametrizadas que arma buildInboxConditions.
 * - Con INBOX_DB_TEST=1 (Postgres local): el endpoint real con datos propios que se borran al final:
 *   view=needs (los dos casos), view=mine, view=closed, counts, waitingSince y que la lista sin `view`
 *   responda igual que la consulta de antes.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { NEEDS_SQL, NOT_SNOOZED_SQL, RECENT_SQL, buildInboxConditions, mineSql, parseInboxView } from './inbox-query.service';

const ORG = '00000000-0000-0000-0000-000000000001';
const USER = '00000000-0000-0000-0000-000000000002';

test('sin view las condiciones son las de antes', () => {
  const AG = '00000000-0000-0000-0000-0000000000aa';
  const f = buildInboxConditions({ orgId: ORG, userId: USER, status: 'active', channel: 'web', agentId: AG });
  assert.deepEqual(f.conditions, ['c.organization_id = $1', 'c.status = $2', 'c.channel = $3', RECENT_SQL, 'c.agent_id = $4']);
  assert.deepEqual(f.params, [ORG, 'active', 'web', AG]);
  // Los contadores por agente no llevan el filtro de agente
  assert.equal(f.baseConditions.length, 4);
  assert.deepEqual(f.baseParams, [ORG, 'active', 'web']);
  assert.ok(!buildInboxConditions({ orgId: ORG, userId: USER, range: 'all' }).conditions.includes(RECENT_SQL));
  // web-44: la búsqueda lee también los mensajes e ignora la vista y el periodo (ver inbox-search.test.ts)
  const s = buildInboxConditions({ orgId: ORG, userId: USER, view: 'all', search: 'ana' });
  assert.equal(s.conditions.length, 2);
  assert.ok(!s.conditions.includes(RECENT_SQL));
  assert.deepEqual(s.params, [ORG, '%ana%']);
});

test('view=needs y view=mine son colas: no las recorta el período', () => {
  const needs = buildInboxConditions({ orgId: ORG, userId: USER, view: 'needs' });
  assert.deepEqual(needs.conditions, ['c.organization_id = $1', NEEDS_SQL]);
  const mine = buildInboxConditions({ orgId: ORG, userId: USER, view: 'mine' });
  // web-42: "Mías" también trae las que pospuse sin dueño; la zona de la organización define "hoy"
  assert.deepEqual(mine.conditions, ['c.organization_id = $1', mineSql('$2', '$3')]);
  assert.deepEqual(mine.params, [ORG, USER, 'UTC']);
  const all = buildInboxConditions({ orgId: ORG, userId: USER, view: 'all' });
  assert.deepEqual(all.conditions, ['c.organization_id = $1', "c.status <> 'closed'", NOT_SNOOZED_SQL, RECENT_SQL]);
  const closed = buildInboxConditions({ orgId: ORG, userId: USER, view: 'closed', range: 'all' });
  assert.deepEqual(closed.conditions, ['c.organization_id = $1', "c.status = 'closed'"]);
});

test('parseInboxView solo acepta las cuatro vistas', () => {
  assert.equal(parseInboxView('needs'), 'needs');
  assert.equal(parseInboxView('mine'), 'mine');
  assert.equal(parseInboxView('todo'), null);
  assert.equal(parseInboxView(undefined), null);
  assert.equal(parseInboxView(['needs']), null);
});

const dbEnabled = process.env['INBOX_DB_TEST'] === '1';

test('endpoint: vistas, contadores, waitingSince y la lista de siempre', { skip: !dbEnabled }, async () => {
  const express = (await import('express')).default;
  const { pool, query } = await import('../config/database');
  const { generateAccessToken } = await import('../config/jwt');
  const { errorHandler } = await import('../middleware/errorHandler');
  const conversationsRouter = (await import('../routes/conversations')).default;

  after(async () => {
    await pool.end();
  });

  const app = express();
  app.use(express.json());
  app.use('/api/conversations', conversationsRouter);
  app.use(errorHandler);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/conversations`;

  const suffix = Math.random().toString(36).slice(2, 10);
  let orgId = '';

  async function makeUser(name: string): Promise<{ id: string; token: string }> {
    const email = `inbox-${suffix}-${name}@example.com`;
    const r = await query<{ id: string }>(
      `INSERT INTO users (organization_id, email, name, password_hash, role, email_verified)
       VALUES ($1, $2, $3, 'x', 'owner', true) RETURNING id`,
      [orgId, email, name]
    );
    const id = r.rows[0]!.id;
    await query('INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)', [id, orgId, 'owner']);
    return { id, token: generateAccessToken({ userId: id, orgId, role: 'owner', email, isSuperAdmin: false }) };
  }

  async function get<T>(token: string, path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200, `${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  try {
    const org = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, plan) VALUES ($1, $2, 'pro') RETURNING id`,
      [`inbox-test-${suffix}`, `inbox-test-${suffix}`]
    );
    orgId = org.rows[0]!.id;
    const ana = await makeUser('Ana');
    const beto = await makeUser('Beto');
    const agent = await query<{ id: string }>(
      `INSERT INTO agents (organization_id, name, system_prompt, llm_provider, llm_model)
       VALUES ($1, 'Agente de prueba', 'x', 'openai', 'gpt-4o-mini') RETURNING id`,
      [orgId]
    );
    const agentId = agent.rows[0]!.id;

    type Msg = [role: string, minutesAgo: number];
    async function conv(
      label: string,
      opts: { status?: string; takenBy?: string | null; handoffMinutesAgo?: number | null; channel?: string; msgs: Msg[] }
    ): Promise<string> {
      const contact = await query<{ id: string }>(
        'INSERT INTO contacts (organization_id, agent_id, name) VALUES ($1, $2, $3) RETURNING id',
        [orgId, agentId, `${label} ${suffix}`]
      );
      const last = opts.msgs.length ? Math.min(...opts.msgs.map((m) => m[1])) : 0;
      const r = await query<{ id: string }>(
        `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status, taken_over_by, taken_over_at,
                                    handed_off_at, last_message_at)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6::uuid IS NULL THEN NULL ELSE NOW() END,
                 CASE WHEN $7::int IS NULL THEN NULL ELSE NOW() - make_interval(mins => $7::int) END,
                 NOW() - make_interval(mins => $8::int))
         RETURNING id`,
        [orgId, agentId, contact.rows[0]!.id, opts.channel ?? 'web', opts.status ?? 'active', opts.takenBy ?? null,
         opts.handoffMinutesAgo ?? null, last]
      );
      const id = r.rows[0]!.id;
      for (const [role, ago] of opts.msgs) {
        await query(
          `INSERT INTO messages (conversation_id, role, content, created_at)
           VALUES ($1, $2, $3, NOW() - make_interval(mins => $4::int))`,
          [id, role, `${label} ${role}`, ago]
        );
      }
      return id;
    }

    const askedForHelp = await conv('pidio-ayuda', { handoffMinutesAgo: 12, msgs: [['user', 14], ['assistant', 13]] });
    const takenUnanswered = await conv('tomada-sin-responder', {
      status: 'human_takeover', takenBy: ana.id, msgs: [['user', 30], ['human', 20], ['user', 5], ['system', 4]],
    });
    const takenAnswered = await conv('tomada-respondida', {
      status: 'human_takeover', takenBy: ana.id, handoffMinutesAgo: 40, msgs: [['user', 45], ['human', 2]],
    });
    const takenByBeto = await conv('tomada-beto', { status: 'human_takeover', takenBy: beto.id, msgs: [['user', 8]] });
    const closed = await conv('cerrada', { status: 'closed', handoffMinutesAgo: 30, msgs: [['user', 60], ['assistant', 59]] });
    const expiredHandoff = await conv('traspaso-vencido', { handoffMinutesAgo: 60 * 48, msgs: [['user', 60 * 48]] });
    const agentOk = await conv('agente-va-bien', { channel: 'whatsapp', msgs: [['user', 3], ['assistant', 3]] });
    // web-42b: pidió ayuda hace 70 min, Ana la tomó hace 60 min y la devolvió al agente → atendida, no cuenta
    const attended = await conv('ayuda-atendida', { handoffMinutesAgo: 70, msgs: [['user', 75], ['human', 50], ['assistant', 25]] });
    // …y si el agente vuelve a pedir ayuda después (handed_off_at nuevo, hace 10 min), cuenta otra vez
    const askedAgain = await conv('ayuda-otra-vez', { handoffMinutesAgo: 10, msgs: [['user', 75], ['human', 50], ['assistant', 11]] });
    await query(
      `UPDATE conversations SET handoff_attended_at = NOW() - interval '60 minutes' WHERE id = ANY($1::uuid[])`,
      [[attended, askedAgain]]
    );

    type ListResponse = {
      conversations: Array<{ id: string; needsAttention: boolean; waitingSince: string | null; lastMessage: { role: string } | null }>;
      pagination: { total: number };
      agentCounts: Array<{ agentId: string; count: number }>;
    };
    const ids = (r: ListResponse) => r.conversations.map((c) => c.id).sort();

    // ── needs: el agente pidió ayuda sin dueño + tomada con el último mensaje del cliente (el system no cuenta)
    const needs = await get<ListResponse>(ana.token, '/?view=needs');
    assert.deepEqual(ids(needs), [askedForHelp, askedAgain, takenUnanswered, takenByBeto].sort());
    // Orden: la que más espera primero (Beto, 8 min sin responder, va después de la de 12 min de traspaso)
    assert.deepEqual(needs.conversations.map((c) => c.id), [askedForHelp, askedAgain, takenByBeto, takenUnanswered]);
    // El segundo pedido espera desde el handed_off_at nuevo (hace 10 min), no desde el primero
    const againMin = (Date.now() - new Date(needs.conversations.find((c) => c.id === askedAgain)!.waitingSince!).getTime()) / 60000;
    assert.ok(againMin > 9 && againMin < 11, `waitingSince ${againMin} min`);
    const help = needs.conversations.find((c) => c.id === askedForHelp)!;
    assert.ok(help.needsAttention && help.waitingSince);
    const unanswered = needs.conversations.find((c) => c.id === takenUnanswered)!;
    // waitingSince del caso tomado = hora del último mensaje del cliente (hace 5 min)
    const waitedMin = (Date.now() - new Date(unanswered.waitingSince!).getTime()) / 60000;
    assert.ok(waitedMin > 4 && waitedMin < 6, `waitingSince ${waitedMin} min`);

    // ── mine: lo que tomó Ana y no está cerrado
    const mine = await get<ListResponse>(ana.token, '/?view=mine');
    assert.deepEqual(ids(mine), [takenUnanswered, takenAnswered].sort());
    const mineBeto = await get<ListResponse>(beto.token, '/?view=mine');
    assert.deepEqual(ids(mineBeto), [takenByBeto]);

    // ── closed y all
    assert.deepEqual(ids(await get<ListResponse>(ana.token, '/?view=closed')), [closed]);
    const all = await get<ListResponse>(ana.token, '/?view=all&range=all&order=needs');
    assert.equal(all.pagination.total, 8);
    const flags = all.conversations.map((c) => c.needsAttention);
    assert.deepEqual(flags, [true, true, true, true, false, false, false, false], 'order=needs pone primero las que necesitan a alguien');
    const answered = all.conversations.find((c) => c.id === takenAnswered)!;
    assert.equal(answered.waitingSince, null);
    assert.equal(all.conversations.find((c) => c.id === agentOk)!.waitingSince, null);
    const attendedRow = all.conversations.find((c) => c.id === attended)!;
    assert.deepEqual([attendedRow.needsAttention, attendedRow.waitingSince], [false, null]);
    // El hilo tampoco muestra el aviso de "pidió ayuda" (handoffActive)
    const detail = await get<{ conversation: { handoffActive: boolean } }>(ana.token, `/${attended}`);
    assert.equal(detail.conversation.handoffActive, false);
    const detailAgain = await get<{ conversation: { handoffActive: boolean } }>(ana.token, `/${askedAgain}`);
    assert.equal(detailAgain.conversation.handoffActive, true);

    // ── counts
    const counts = await get<{
      all: number; needs: number; mine: number; closed: number;
      byAgent: Array<{ agentId: string; count: number }>; byChannel: Array<{ channel: string; count: number }>;
    }>(ana.token, '/counts');
    // El traspaso vencido (48 h) ya no necesita a nadie, pero sigue abierta y dentro de los 8 días
    assert.deepEqual({ all: counts.all, needs: counts.needs, mine: counts.mine, closed: counts.closed }, { all: 8, needs: 4, mine: 2, closed: 1 });
    assert.deepEqual(counts.byAgent, [{ agentId, agentName: 'Agente de prueba', count: 8 }]);
    assert.deepEqual(
      [...counts.byChannel].sort((a, b) => a.channel.localeCompare(b.channel)),
      [{ channel: 'web', count: 7 }, { channel: 'whatsapp', count: 1 }]
    );
    assert.equal((await get<{ mine: number }>(beto.token, '/counts')).mine, 1);

    // ── la lista sin view responde igual que la consulta de antes (mismas filas, orden y total)
    const legacySql = `SELECT c.id FROM conversations c LEFT JOIN contacts co ON c.contact_id = co.id
      WHERE c.organization_id = $1 AND COALESCE(c.last_message_at, c.created_at) >= NOW() - interval '8 days'
      ORDER BY c.last_message_at DESC NULLS LAST`;
    const legacy = await query<{ id: string }>(legacySql, [orgId]);
    const plain = await get<ListResponse>(ana.token, '/?limit=100');
    assert.deepEqual(plain.conversations.map((c) => c.id), legacy.rows.map((r) => r.id));
    assert.equal(plain.pagination.total, 9);
    assert.deepEqual(plain.agentCounts, [{ agentId, agentName: 'Agente de prueba', count: 9 }]);
    const filtered = await get<ListResponse>(ana.token, '/?status=closed');
    assert.deepEqual(ids(filtered), [closed]);
    assert.ok(expiredHandoff);

    // view inválida → 400
    const bad = await fetch(`${base}/?view=todo`, { headers: { Authorization: `Bearer ${ana.token}` } });
    assert.equal(bad.status, 400);
  } finally {
    server.close();
    if (orgId) {
      await query('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE organization_id = $1)', [orgId]);
      await query('DELETE FROM conversations WHERE organization_id = $1', [orgId]);
      await query('DELETE FROM contacts WHERE organization_id = $1', [orgId]);
      await query('DELETE FROM agents WHERE organization_id = $1', [orgId]);
      await query('DELETE FROM user_organizations WHERE organization_id = $1', [orgId]);
      await query('DELETE FROM users WHERE organization_id = $1', [orgId]);
      await query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }
  }
});
