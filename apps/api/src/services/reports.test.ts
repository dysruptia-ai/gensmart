/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Informes (web-47). Las funciones puras corren siempre; con REPORTS_DB_TEST=1, cada número con casos
 * armados a mano (cada organización es del test), la ruta (Solo y period inválido) y agent-stats.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, peakWindow, periodBounds, summarizeHandoffs, type HandoffRow } from './reports.service';

const dbEnabled = process.env['REPORTS_DB_TEST'] === '1';

test('periodBounds: hoy, 7 y 30 días en la zona local, y el período anterior', () => {
  const now = new Date('2026-11-20T20:00:00Z'); // 15:00 en Bogotá
  const t = periodBounds('today', 'America/Bogota', now);
  assert.equal(t.start.toISOString(), '2026-11-20T05:00:00.000Z');
  assert.equal(t.end.toISOString(), now.toISOString());
  assert.equal(t.prevStart.toISOString(), '2026-11-19T05:00:00.000Z');
  assert.equal(t.prevEnd.toISOString(), '2026-11-19T20:00:00.000Z');
  const w = periodBounds('7d', 'America/Bogota', now);
  assert.equal(w.start.toISOString(), '2026-11-14T05:00:00.000Z');
  assert.equal(w.prevStart.toISOString(), '2026-11-07T05:00:00.000Z');
  assert.equal(w.prevEnd.toISOString(), w.start.toISOString());
  const m = periodBounds('30d', 'UTC', now);
  assert.equal(m.start.toISOString(), '2026-10-22T00:00:00.000Z');
  assert.equal(m.prevStart.toISOString(), '2026-09-22T00:00:00.000Z');
  // cambio de horario: Nueva York sale del horario de verano el 1 de noviembre de 2026
  const ny = periodBounds('7d', 'America/New_York', new Date('2026-11-03T15:00:00Z'));
  assert.equal(ny.start.toISOString(), '2026-10-28T04:00:00.000Z'); // medianoche EDT
  const nyToday = periodBounds('today', 'America/New_York', new Date('2026-11-03T15:00:00Z'));
  assert.equal(nyToday.start.toISOString(), '2026-11-03T05:00:00.000Z'); // medianoche EST
});

test('median y peakWindow', () => {
  assert.equal(median([]), null);
  assert.equal(median([8, 60, 20]), 20);
  assert.equal(median([5, 30]), 17.5);
  const hours = new Array<number>(24).fill(0);
  assert.equal(peakWindow(hours), null);
  hours[9] = 5;
  hours[10] = 6;
  hours[11] = 4;
  hours[20] = 5;
  assert.deepEqual(peakWindow(hours), { from: 9, to: 12, pct: 75 });
  assert.equal(peakWindow([...new Array<number>(23).fill(0), 9]), null); // < 10
});

test('summarizeHandoffs: meta, espera y los que siguen esperando', () => {
  const now = new Date('2026-11-20T20:00:00Z');
  const at = (iso: string) => new Date(iso);
  const rows: HandoffRow[] = [
    { requestedAt: at('2026-11-20T18:01:00Z'), attendedAt: at('2026-11-20T18:06:00Z'), closed: false, reason: null, agentId: null },
    { requestedAt: at('2026-11-20T18:11:00Z'), attendedAt: at('2026-11-20T18:41:00Z'), closed: false, reason: null, agentId: null },
    { requestedAt: at('2026-11-20T19:50:00Z'), attendedAt: null, closed: false, reason: null, agentId: null }, // dentro de la meta
    { requestedAt: at('2026-11-20T16:00:00Z'), attendedAt: null, closed: false, reason: null, agentId: null }, // pasada
    { requestedAt: at('2026-11-20T16:00:00Z'), attendedAt: null, closed: true, reason: null, agentId: null }, // cerrada, pasada
  ];
  const s = summarizeHandoffs(rows, null, 'UTC', 15, now);
  assert.deepEqual(s, { waitMedian: 17.5, stillWaiting: 2, goalMet: 1, goalTotal: 4, realMinutes: false });
});

test('informes con la base', { skip: !dbEnabled }, async () => {
  const { startInboxFixture, errorCode } = await import('./inbox-test-fixture');
  const { buildInboxReport } = await import('./reports.service');
  const fx = await startInboxFixture('ireports');
  try {
    const org = await fx.makeOrg('pro');
    await fx.query(`UPDATE organizations SET settings = COALESCE(settings, '{}'::jsonb) || '{"timezone":"America/Bogota"}' WHERE id = $1`, [org]);
    const owner = await fx.makeUser(org, 'Camila', 'owner');
    const ventas = await fx.makeAgent(org, 'Ventas');
    const soporte = await fx.makeAgent(org, 'Soporte');
    const borrador = await fx.makeAgent(org, 'Borrador');
    await fx.query(`UPDATE agents SET status = 'active' WHERE id IN ($1, $2)`, [ventas, soporte]);
    await fx.query(`UPDATE agents SET inbox_paused_at = NOW() WHERE id = $1`, [soporte]);
    const contact = await fx.query<{ id: string }>(`INSERT INTO contacts (organization_id, agent_id, name) VALUES ($1, $2, 'C') RETURNING id`, [org, ventas]);

    type Msg = [role: string, iso: string];
    type Ev = [type: string, iso: string, data?: Record<string, unknown>, target?: string];
    const conv = async (agent: string, channel: string, msgs: Msg[], events: Ev[] = [], status = 'active'): Promise<string> => {
      const r = await fx.query<{ id: string }>(
        `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status, last_message_at, message_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [org, agent, contact.rows[0]!.id, channel, status, msgs[msgs.length - 1]![1], msgs.length]
      );
      const id = r.rows[0]!.id;
      for (const [role, iso] of msgs) {
        await fx.query(`INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, $2, 'x', $3)`, [id, role, iso]);
      }
      for (const [type, iso, data, target] of events) {
        await fx.query(
          `INSERT INTO conversation_events (organization_id, conversation_id, type, target_user_id, data, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
          [org, id, type, target ?? null, JSON.stringify(data ?? {}), iso]
        );
      }
      return id;
    };

    // hoy (20 de nov., Bogotá = UTC-5)
    await conv(ventas, 'web', [['user', '2026-11-20T14:00:00Z'], ['assistant', '2026-11-20T14:00:08Z']]); // solo el agente, 8 s
    await conv(ventas, 'web', [['user', '2026-11-20T14:30:00Z'], ['assistant', '2026-11-20T14:30:20Z'], ['human', '2026-11-20T14:40:00Z']]);
    await conv(ventas, 'whatsapp', [['user', '2026-11-20T15:00:00Z'], ['assistant', '2026-11-20T15:01:00Z']], [['taken', '2026-11-20T15:05:00Z']]);
    await conv(soporte, 'whatsapp', [['user', '2026-11-20T18:00:00Z']], [
      ['handoff_requested', '2026-11-20T18:01:00Z', { reason: 'customer_asked' }],
      ['taken', '2026-11-20T18:06:00Z'],
    ]);
    await conv(soporte, 'web', [['user', '2026-11-20T18:10:00Z'], ['human', '2026-11-20T18:41:00Z']], [['handoff_requested', '2026-11-20T18:11:00Z']]);
    await conv(soporte, 'telegram', [['user', '2026-11-20T19:00:00Z']], [['handoff_requested', '2026-11-20T19:50:00Z', { reason: 'could_not_solve' }]]);
    await conv(ventas, 'web', [['user', '2026-11-20T16:00:00Z']], [['handoff_requested', '2026-11-20T16:00:00Z', { reason: 'out_of_scope' }]]);
    // ayer: solo el agente, 4 s (período anterior); y una a las 23:59 de ayer (fuera de los dos)
    await conv(ventas, 'web', [['user', '2026-11-19T14:00:00Z'], ['assistant', '2026-11-19T14:00:04Z']]);
    await conv(ventas, 'web', [['user', '2026-11-20T04:59:00Z'], ['user', '2026-11-20T14:00:00Z']]);

    const now = new Date('2026-11-20T20:00:00Z');
    const r = await buildInboxReport({
      organizationId: org,
      period: 'today',
      timeZone: 'America/Bogota',
      planAllowsPeople: true,
      businessHours: null,
      responseGoalMinutes: 15,
      now,
    });
    assert.deepEqual(r.kpis.agentResolved, { pct: 14.3, count: 1, total: 7, prevPct: 100 });
    assert.deepEqual(r.kpis.firstResponseSeconds, { median: 20, prev: 4 });
    assert.deepEqual(r.kpis.humanWaitMinutes, { median: 17.5, prev: null, stillWaiting: 2 });
    assert.deepEqual(r.kpis.goalMet, { pct: 33.3, met: 1, total: 3, prevPct: null });
    const hours = new Array<number>(24).fill(0);
    hours[9] = 2;
    hours[10] = 1;
    hours[11] = 1;
    hours[13] = 2;
    hours[14] = 1;
    assert.deepEqual(r.byHour, hours);
    assert.equal(r.peak, null); // < 10 conversaciones
    assert.deepEqual(r.byChannel, [
      { channel: 'web', count: 4 },
      { channel: 'whatsapp', count: 2 },
      { channel: 'telegram', count: 1 },
    ]);
    assert.equal(r.handoffReasons.length, 4);
    assert.ok(r.handoffReasons.some((x) => x.reason === null && x.count === 1 && x.pct === 25));
    assert.deepEqual(
      r.agents.map((a) => [a.name, a.conversations, a.resolvedAlone, a.askedHelp, a.status]),
      [
        ['Ventas', 4, 1, 1, 'active'],
        ['Soporte', 3, 0, 3, 'paused'],
        ['Borrador', 0, 0, 0, 'unpublished'],
      ]
    );
    assert.equal(r.agents[0]!.resolvedAlonePct, 25);
    assert.equal(r.agents[2]!.resolvedAlonePct, null);
    void borrador;

    // espera en minutos de atención, con un horario que cruza la noche (8-18 todos los días)
    const nightOrg = org; // misma organización, otro período: el pedido es del miércoles 18 a las 17:50 local
    await conv(ventas, 'web', [['user', '2026-11-18T22:49:00Z']], [
      ['handoff_requested', '2026-11-18T22:50:00Z', { reason: 'agent_paused' }],
      ['assigned', '2026-11-18T23:00:00Z', {}], // reparto sin persona: no atiende
      ['transferred', '2026-11-19T13:10:00Z', {}, owner.id], // 08:10 del jueves
    ], 'closed');
    const all = { '1': { open: '08:00', close: '18:00' }, '2': { open: '08:00', close: '18:00' }, '3': { open: '08:00', close: '18:00' }, '4': { open: '08:00', close: '18:00' }, '5': { open: '08:00', close: '18:00' }, '6': { open: '08:00', close: '18:00' }, '7': { open: '08:00', close: '18:00' } };
    const week = await buildInboxReport({
      organizationId: nightOrg,
      period: '7d',
      timeZone: 'America/Bogota',
      planAllowsPeople: true,
      businessHours: all,
      responseGoalMinutes: 15,
      now,
    });
    assert.equal(week.kpis.agentResolved.total, 10); // 7 de hoy + ayer + la de las 23:59 + la del miércoles
    // waits: 5, 30, 20 (17:50→18:00 + 08:00→08:10) → mediana 20
    assert.equal(week.kpis.humanWaitMinutes!.median, 20);
    assert.ok(week.handoffReasons.some((x) => x.reason === 'agent_paused'));

    // ruta: period inválido y Solo
    assert.equal((await fx.call(owner.token, 'GET', '/reports/inbox?period=1y')).status, 400);
    assert.equal(errorCode(await fx.call(owner.token, 'GET', '/reports/inbox?period=1y')), 'VALIDATION_ERROR');
    const ok = await fx.call(owner.token, 'GET', '/reports/inbox?period=30d');
    assert.equal(ok.status, 200);
    assert.equal(ok.json['planAllowsPeople'], true);
    assert.equal((ok.json['byHour'] as number[]).length, 24);
    const soloOrg = await fx.makeOrg('solo');
    const soloOwner = await fx.makeUser(soloOrg, 'Solo', 'owner');
    await fx.makeAgent(soloOrg);
    const solo = await fx.call(soloOwner.token, 'GET', '/reports/inbox');
    assert.equal(solo.status, 200);
    assert.equal(solo.json['planAllowsPeople'], false);
    const kpis = solo.json['kpis'] as Record<string, unknown>;
    assert.equal(kpis['humanWaitMinutes'], null);
    assert.equal(kpis['goalMet'], null);
    assert.ok(kpis['agentResolved']);

    // agent-stats con la nueva regla: abiertas también cuentan; con mensaje human, no
    const statsOrg = await fx.makeOrg('pro');
    const statsUser = await fx.makeUser(statsOrg, 'Ana', 'owner');
    const statsAgent = await fx.makeAgent(statsOrg);
    const a1 = await fx.makeConversation(statsOrg, statsAgent);
    const a2 = await fx.makeConversation(statsOrg, statsAgent);
    const a3 = await fx.makeConversation(statsOrg, statsAgent, { status: 'closed' });
    await fx.query(`UPDATE messages SET created_at = NOW() WHERE conversation_id IN ($1, $2, $3)`, [a1, a2, a3]);
    await fx.query(`INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'human', 'hola')`, [a2]);
    await fx.query(`INSERT INTO conversation_events (organization_id, conversation_id, type) VALUES ($1, $2, 'handoff_requested')`, [statsOrg, a3]);
    const st = await fx.call(statsUser.token, 'GET', `/conversations/agent-stats?agentId=${statsAgent}`);
    assert.equal(st.status, 200);
    assert.deepEqual(st.json, { agentId: statsAgent, today: 3, solvedAlone: 1, askedHelp: 1 });
  } finally {
    await fx.cleanup();
  }
});
