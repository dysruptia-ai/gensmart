/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-42): transferir, posponer, cerrar con resultado, reabrir, borrar e historial de eventos.
 * - Siempre: que el agente no lea los eventos (el worker arma el historial solo con `messages`).
 * - Con CONV_ACTIONS_DB_TEST=1 (Postgres local): los endpoints reales con datos propios que se borran al final.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { parseOutcome, validTimezone } from './conversation-events.service';

test('el worker del agente nunca lee conversation_events', () => {
  const workers = path.resolve(__dirname, '../workers');
  for (const file of fs.readdirSync(workers)) {
    const src = fs.readFileSync(path.join(workers, file), 'utf8');
    assert.ok(!src.includes('conversation_events'), `${file} no debe leer conversation_events`);
  }
  for (const file of ['agent-config.service.ts', 'tool-loop.service.ts']) {
    const p = path.join(__dirname, file);
    if (fs.existsSync(p)) assert.ok(!fs.readFileSync(p, 'utf8').includes('conversation_events'), file);
  }
});

test('parseOutcome y validTimezone', () => {
  assert.equal(parseOutcome('sold'), 'sold');
  assert.equal(parseOutcome('no_response'), 'no_response');
  assert.equal(parseOutcome('vendido'), null);
  assert.equal(parseOutcome(undefined), null);
  assert.equal(validTimezone('America/Bogota'), 'America/Bogota');
  assert.equal(validTimezone('Mars/Olympus'), null);
  assert.equal(validTimezone(''), null);
});

const dbEnabled = process.env['CONV_ACTIONS_DB_TEST'] === '1';

test('endpoints: transferir, posponer, cerrar, reabrir, borrar y eventos', { skip: !dbEnabled }, async () => {
  const express = (await import('express')).default;
  const { pool, query } = await import('../config/database');
  const { generateAccessToken } = await import('../config/jwt');
  const { errorHandler } = await import('../middleware/errorHandler');
  const conversationsRouter = (await import('../routes/conversations')).default;
  const { releaseDueSnoozes, unsnoozeOnCustomerMessage } = await import('./conversation-events.service');

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
  const orgIds: string[] = [];

  async function makeOrg(plan: string): Promise<string> {
    const r = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, plan, settings) VALUES ($1, $1, $2, '{"timezone":"America/Bogota"}') RETURNING id`,
      [`actions-${plan}-${suffix}-${orgIds.length}`, plan]
    );
    orgIds.push(r.rows[0]!.id);
    return r.rows[0]!.id;
  }

  async function makeUser(orgId: string, name: string, role: string): Promise<{ id: string; token: string }> {
    const email = `actions-${suffix}-${name}@example.com`;
    const r = await query<{ id: string }>(
      `INSERT INTO users (organization_id, email, name, password_hash, role, email_verified, language)
       VALUES ($1, $2, $3, 'x', $4, true, 'es') RETURNING id`,
      [orgId, email, name, role]
    );
    const id = r.rows[0]!.id;
    await query('INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)', [id, orgId, role]);
    return { id, token: generateAccessToken({ userId: id, orgId, role, email, isSuperAdmin: false }) };
  }

  async function call(token: string, method: string, p: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
  }

  try {
    const orgId = await makeOrg('pro');
    const owner = await makeUser(orgId, 'Olga', 'owner');
    const admin = await makeUser(orgId, 'Adan', 'admin');
    const ana = await makeUser(orgId, 'Ana', 'member');
    const beto = await makeUser(orgId, 'Beto', 'member');
    const otherOrg = await makeOrg('pro');
    const stranger = await makeUser(otherOrg, 'Extra', 'owner');
    const agent = await query<{ id: string }>(
      `INSERT INTO agents (organization_id, name, system_prompt, llm_provider, llm_model)
       VALUES ($1, 'Agente de prueba', 'x', 'openai', 'gpt-4o-mini') RETURNING id`,
      [orgId]
    );
    const agentId = agent.rows[0]!.id;

    // Mensajes de antes de que la tomaran: así "devolver" no llama al modelo para el resumen
    async function conv(label: string, opts: { status?: string; takenBy?: string | null; org?: string; agent?: string } = {}): Promise<string> {
      const org = opts.org ?? orgId;
      const contact = await query<{ id: string }>(
        'INSERT INTO contacts (organization_id, agent_id, name) VALUES ($1, $2, $3) RETURNING id',
        [org, opts.agent ?? agentId, `${label} ${suffix}`]
      );
      const r = await query<{ id: string }>(
        `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status, taken_over_by, taken_over_at, last_message_at)
         VALUES ($1, $2, $3, 'web', $4, $5, CASE WHEN $5::uuid IS NULL THEN NULL ELSE NOW() END, NOW() - interval '10 minutes')
         RETURNING id`,
        [org, opts.agent ?? agentId, contact.rows[0]!.id, opts.status ?? 'active', opts.takenBy ?? null]
      );
      const id = r.rows[0]!.id;
      await query(
        `INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, 'user', 'hola', NOW() - interval '10 minutes')`,
        [id]
      );
      return id;
    }
    const events = async (id: string) =>
      (await query<{ type: string; actor_user_id: string | null; target_user_id: string | null; data: Record<string, unknown> }>(
        'SELECT type, actor_user_id, target_user_id, data FROM conversation_events WHERE conversation_id = $1 ORDER BY created_at, id',
        [id]
      )).rows;
    const listIds = async (token: string, q: string) =>
      ((await call(token, 'GET', q)).json['conversations'] as Array<{ id: string }>).map((c) => c.id);

    // ── tomar y transferir ──────────────────────────────────────────────────
    const c1 = await conv('transferir');
    assert.equal((await call(ana.token, 'POST', `/${c1}/takeover`)).status, 200);
    // Beto (member) no la tiene: no puede transferirla
    assert.equal((await call(beto.token, 'POST', `/${c1}/transfer`, { toUserId: beto.id })).status, 403);
    // Nota de más de 500 caracteres
    assert.equal((await call(ana.token, 'POST', `/${c1}/transfer`, { toUserId: beto.id, note: 'x'.repeat(501) })).status, 400);
    // Alguien de otra organización
    const notMember = await call(ana.token, 'POST', `/${c1}/transfer`, { toUserId: stranger.id });
    assert.equal(notMember.status, 400);
    assert.equal((notMember.json['error'] as { code: string }).code, 'NOT_A_MEMBER');
    // Quien la tiene → Beto, con nota
    const tr = await call(ana.token, 'POST', `/${c1}/transfer`, { toUserId: beto.id, note: 'Falta confirmar la talla' });
    assert.equal(tr.status, 200);
    const afterTr = await query<{ status: string; taken_over_by: string }>('SELECT status, taken_over_by FROM conversations WHERE id = $1', [c1]);
    assert.deepEqual(afterTr.rows[0], { status: 'human_takeover', taken_over_by: beto.id });
    // Tomar y recibir por transferencia marcan el pedido de ayuda como atendido (web-42b)
    const attendedAt = await query<{ ok: boolean }>(
      `SELECT handoff_attended_at IS NOT NULL AND handoff_attended_at >= taken_over_at AS ok FROM conversations WHERE id = $1`,
      [c1]
    );
    assert.equal(attendedAt.rows[0]!.ok, true);
    const notif = await query<{ type: string; data: Record<string, unknown>; email_sent: boolean }>(
      `SELECT type, data, email_sent FROM notifications WHERE user_id = $1`,
      [beto.id]
    );
    assert.equal(notif.rows.length, 1);
    assert.equal(notif.rows[0]!.type, 'conversation_transferred');
    assert.equal(notif.rows[0]!.data['conversationId'], c1);
    assert.equal(notif.rows[0]!.email_sent, false);
    // El admin puede transferir una que no tiene; el owner la toma para sí ("Tomarla tú")
    assert.equal((await call(admin.token, 'POST', `/${c1}/transfer`, { toUserId: ana.id })).status, 200);
    assert.equal((await call(owner.token, 'POST', `/${c1}/transfer`, { toUserId: owner.id })).status, 200);
    // Un member no puede quitársela a otra persona
    assert.equal((await call(beto.token, 'POST', `/${c1}/transfer`, { toUserId: beto.id })).status, 403);
    // Devolver al agente desde el cuadro de transferir
    assert.equal((await call(owner.token, 'POST', `/${c1}/transfer`, { toUserId: null })).status, 200);
    const e1 = await events(c1);
    assert.deepEqual(e1.map((e) => e.type), ['taken', 'transferred', 'transferred', 'taken', 'released']);
    assert.equal(e1[1]!.data['note'], 'Falta confirmar la talla');
    assert.equal(e1[1]!.actor_user_id, ana.id);
    assert.equal(e1[1]!.target_user_id, beto.id);
    assert.equal(e1[3]!.data['fromUserId'], ana.id);

    // Plan de quien recibe: en Solo no se pueden tomar conversaciones
    const soloOrg = await makeOrg('solo');
    const soloOwner = await makeUser(soloOrg, 'SoloOwner', 'owner');
    const soloMember = await makeUser(soloOrg, 'SoloMember', 'member');
    const soloAgent = await query<{ id: string }>(
      `INSERT INTO agents (organization_id, name, system_prompt, llm_provider, llm_model) VALUES ($1, 'A', 'x', 'openai', 'gpt-4o-mini') RETURNING id`,
      [soloOrg]
    );
    const cSolo = await conv('solo', { org: soloOrg, agent: soloAgent.rows[0]!.id });
    const soloTr = await call(soloOwner.token, 'POST', `/${cSolo}/transfer`, { toUserId: soloMember.id });
    assert.equal(soloTr.status, 403);
    assert.equal((soloTr.json['error'] as { code: string }).code, 'PLAN_LIMIT');

    // ── posponer ────────────────────────────────────────────────────────────
    const c2 = await conv('posponer');
    const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString();
    assert.equal((await call(ana.token, 'POST', `/${c2}/snooze`, { until: new Date(Date.now() - 1000).toISOString() })).status, 400);
    assert.equal((await call(ana.token, 'POST', `/${c2}/snooze`, { until: 'mañana' })).status, 400);
    assert.equal((await call(ana.token, 'POST', `/${c2}/snooze`, { until: tomorrow })).status, 200);
    assert.ok(!(await listIds(ana.token, '/?view=all&range=all')).includes(c2), 'pospuesta: fuera de Todas');
    assert.ok((await listIds(ana.token, '/?view=mine')).includes(c2), 'pospuesta: en Mías');
    assert.ok(!(await listIds(beto.token, '/?view=mine')).includes(c2), 'no está en Mías de otra persona');
    const counts = (await call(ana.token, 'GET', '/counts?range=all')).json;
    assert.equal(counts['mine'], 1);
    // Vuelve antes si el cliente escribe
    await unsnoozeOnCustomerMessage(c2);
    const back = await query<{ snoozed_until: string | null; follow_up_at: string | null }>(
      'SELECT snoozed_until, follow_up_at FROM conversations WHERE id = $1',
      [c2]
    );
    assert.equal(back.rows[0]!.snoozed_until, null);
    assert.ok(back.rows[0]!.follow_up_at);
    assert.ok((await listIds(ana.token, '/?view=all&range=all')).includes(c2), 'volvió: otra vez en Todas');
    // Quitar la posposición a mano; sin posponer → 400
    assert.equal((await call(ana.token, 'POST', `/${c2}/snooze`, { until: tomorrow })).status, 200);
    assert.equal((await call(ana.token, 'DELETE', `/${c2}/snooze`)).status, 200);
    assert.equal((await call(ana.token, 'DELETE', `/${c2}/snooze`)).status, 400);

    // Con el cron: una tomada por Ana, pospuesta y vencida
    const c3 = await conv('cron', { status: 'human_takeover', takenBy: ana.id });
    assert.equal((await call(ana.token, 'POST', `/${c3}/snooze`, { until: tomorrow })).status, 200);
    await query(`UPDATE conversations SET snoozed_until = NOW() - interval '1 minute' WHERE id = $1`, [c3]);
    assert.equal(await releaseDueSnoozes([c3]), 1);
    const c3row = await query<{ snoozed_until: string | null; follow_up_at: string | null }>(
      'SELECT snoozed_until, follow_up_at FROM conversations WHERE id = $1',
      [c3]
    );
    assert.equal(c3row.rows[0]!.snoozed_until, null);
    assert.ok(c3row.rows[0]!.follow_up_at);
    const mine = (await call(ana.token, 'GET', '/?view=mine')).json['conversations'] as Array<{ id: string; followUpPending: boolean }>;
    assert.equal(mine[0]!.id, c3, '"Seguimiento para hoy" va primero');
    assert.equal(mine[0]!.followUpPending, true);
    const anaNotif = await query<{ type: string }>(`SELECT type FROM notifications WHERE user_id = $1`, [ana.id]);
    assert.ok(anaNotif.rows.some((n) => n.type === 'conversation_snooze_ended'));
    // Respondida después de volver → deja de estar en seguimiento
    await query(`INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'human', 'Ya te respondo')`, [c3]);
    const mine2 = (await call(ana.token, 'GET', '/?view=mine')).json['conversations'] as Array<{ id: string; followUpPending: boolean }>;
    assert.equal(mine2.find((c) => c.id === c3)!.followUpPending, false);
    assert.deepEqual((await events(c3)).map((e) => [e.type, e.data['reason'] ?? null]), [
      ['snoozed', null],
      ['unsnoozed', 'timer'],
    ]);
    assert.deepEqual((await events(c2)).map((e) => [e.type, e.data['reason'] ?? null]), [
      ['snoozed', null],
      ['unsnoozed', 'customer_message'],
      ['snoozed', null],
      ['unsnoozed', 'manual'],
    ]);

    // ── cerrar con y sin resultado, filtro y reabrir ────────────────────────
    const c4 = await conv('cerrar-vendido');
    const c5 = await conv('cerrar-sin-resultado');
    assert.equal((await call(ana.token, 'PUT', `/${c4}/close`, { outcome: 'ganado' })).status, 400);
    assert.equal((await call(ana.token, 'PUT', `/${c4}/close`, { outcome: 'sold' })).status, 200);
    assert.equal((await call(ana.token, 'PUT', `/${c5}/close`)).status, 200);
    const closedRows = await query<{ id: string; closed_outcome: string | null; closed_by: string; closed_at: string }>(
      'SELECT id, closed_outcome, closed_by, closed_at FROM conversations WHERE id = ANY($1::uuid[]) ORDER BY closed_outcome NULLS LAST',
      [[c4, c5]]
    );
    assert.deepEqual(closedRows.rows.map((r) => [r.id, r.closed_outcome, r.closed_by]), [[c4, 'sold', ana.id], [c5, null, ana.id]]);
    assert.deepEqual(await listIds(ana.token, '/?view=closed&range=all&outcome=sold'), [c4]);
    assert.equal((await call(ana.token, 'GET', '/?view=closed&outcome=ganado')).status, 400);
    const detail = (await call(ana.token, 'GET', `/${c4}`)).json as {
      conversation: { closedOutcome: string; closedByName: string };
      events: Array<{ type: string; actorName: string; data: Record<string, unknown> }>;
    };
    assert.equal(detail.conversation.closedOutcome, 'sold');
    assert.equal(detail.conversation.closedByName, 'Ana');
    assert.deepEqual(detail.events.map((e) => [e.type, e.actorName, e.data['outcome']]), [['closed', 'Ana', 'sold']]);

    assert.equal((await call(beto.token, 'POST', `/${c4}/reopen`)).status, 200);
    const reopened = await query<{ status: string; closed_outcome: string | null; closed_at: string | null; closed_by: string | null }>(
      'SELECT status, closed_outcome, closed_at, closed_by FROM conversations WHERE id = $1',
      [c4]
    );
    assert.deepEqual(reopened.rows[0], { status: 'active', closed_outcome: null, closed_at: null, closed_by: null });
    assert.equal((await call(beto.token, 'POST', `/${c4}/reopen`)).status, 400);
    assert.deepEqual((await events(c4)).map((e) => e.type), ['closed', 'reopened']);
    // Otra organización no la ve
    assert.equal((await call(stranger.token, 'POST', `/${c5}/reopen`)).status, 404);

    // ── el agente no ve los eventos: ninguna acción escribió en messages ─────
    const msgs = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM messages WHERE conversation_id = ANY($1::uuid[]) AND role <> 'user' AND content <> 'Ya te respondo'`,
      [[c1, c2, c3, c4, c5]]
    );
    assert.equal(msgs.rows[0]!.n, '0');
    const noteInMessages = await query(`SELECT 1 FROM messages WHERE content LIKE '%Falta confirmar la talla%'`);
    assert.equal(noteInMessages.rows.length, 0);

    // ── borrar: solo owner y admin (y se van sus eventos) ───────────────────
    const d1 = await conv('borrar-1');
    const d2 = await conv('borrar-2');
    await call(ana.token, 'POST', `/${d1}/snooze`, { until: tomorrow });
    assert.equal((await call(ana.token, 'DELETE', `/${d1}`)).status, 403);
    assert.equal((await call(ana.token, 'DELETE', '/bulk', { conversationIds: [d1] })).status, 403);
    assert.equal((await call(admin.token, 'DELETE', `/${d1}`)).status, 204);
    assert.equal((await call(owner.token, 'DELETE', `/${d2}`)).status, 204);
    assert.equal((await events(d1)).length, 0, 'ON DELETE CASCADE');
  } finally {
    server.close();
    for (const id of orgIds) {
      await query('DELETE FROM notifications WHERE organization_id = $1', [id]);
      await query('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE organization_id = $1)', [id]);
      await query('DELETE FROM conversations WHERE organization_id = $1', [id]);
      await query('DELETE FROM contacts WHERE organization_id = $1', [id]);
      await query('DELETE FROM agents WHERE organization_id = $1', [id]);
      await query('DELETE FROM user_organizations WHERE organization_id = $1', [id]);
      await query('DELETE FROM users WHERE organization_id = $1', [id]);
      await query('DELETE FROM organizations WHERE id = $1', [id]);
    }
  }
});
