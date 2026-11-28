/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-45): GET/PUT /api/inbox-settings.
 * Con INBOX_SETTINGS_DB_TEST=1: roles, validación, equipo y responsables solo de la organización, y Solo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const dbEnabled = process.env['INBOX_SETTINGS_DB_TEST'] === '1';

test('endpoint: ajustes de la bandeja', { skip: !dbEnabled }, async () => {
  const { startInboxFixture, errorCode } = await import('./inbox-test-fixture');
  const fx = await startInboxFixture('isettings');
  const spy = await fx.spyEmits();
  try {
    const org = await fx.makeOrg('pro');
    const other = await fx.makeOrg('pro');
    const soloOrg = await fx.makeOrg('solo');
    const owner = await fx.makeUser(org, 'Camila', 'owner');
    const admin = await fx.makeUser(org, 'Andrés', 'admin');
    const ana = await fx.makeUser(org, 'Ana', 'member');
    const stranger = await fx.makeUser(other, 'Otro', 'owner');
    const soloOwner = await fx.makeUser(soloOrg, 'Solo', 'owner');
    const agent = await fx.makeAgent(org, 'Ventas');
    const foreignAgent = await fx.makeAgent(other);

    // GET: cualquier rol, con los valores por defecto
    const g = await fx.call(ana.token, 'GET', '/inbox-settings');
    assert.equal(g.status, 200);
    const settings = g.json['settings'] as Record<string, unknown>;
    assert.equal(settings['assignmentMode'], 'none');
    assert.equal(settings['businessHours'], null);
    assert.equal(settings['responseGoalMinutes'], 15);
    assert.equal(settings['alertEmailMinutes'], null);
    assert.equal(g.json['plan'], 'pro');
    const team = g.json['team'] as Array<Record<string, unknown>>;
    assert.equal(team.length, 3);
    assert.deepEqual(
      Object.keys(team[0]!).sort(),
      ['capacity', 'name', 'online', 'openCount', 'receives', 'role', 'userId'].sort()
    );
    assert.deepEqual(g.json['agentAssignees'], [{ agentId: agent, agentName: 'Ventas', userId: null }]);

    // PUT: miembros no
    assert.equal((await fx.call(ana.token, 'PUT', '/inbox-settings', { assignmentMode: 'rotating' })).status, 403);

    // horario: formato y orden
    const badFormat = await fx.call(owner.token, 'PUT', '/inbox-settings', { businessHours: { '1': { open: '8:00', close: '18:00' } } });
    assert.equal(badFormat.status, 400);
    const badOrder = await fx.call(owner.token, 'PUT', '/inbox-settings', { businessHours: { '1': { open: '18:00', close: '08:00' } } });
    assert.equal(badOrder.status, 422);
    assert.equal(errorCode(badOrder), 'invalid_business_hours');
    // meta
    assert.equal((await fx.call(owner.token, 'PUT', '/inbox-settings', { responseGoalMinutes: 0 })).status, 400);
    assert.equal((await fx.call(owner.token, 'PUT', '/inbox-settings', { responseGoalMinutes: 241 })).status, 400);
    // alerta mayor que la meta
    const notAbove = await fx.call(owner.token, 'PUT', '/inbox-settings', { responseGoalMinutes: 15, alertEmailMinutes: 15 });
    assert.equal(notAbove.status, 422);
    assert.equal(errorCode(notAbove), 'alert_not_above_goal');
    // subir la meta por encima de la alerta guardada también falla
    assert.equal((await fx.call(admin.token, 'PUT', '/inbox-settings', { alertEmailMinutes: 30 })).status, 200);
    assert.equal(errorCode(await fx.call(admin.token, 'PUT', '/inbox-settings', { responseGoalMinutes: 45 })), 'alert_not_above_goal');
    assert.equal((await fx.call(owner.token, 'PUT', '/inbox-settings', { alertEmailMinutes: 1441 })).status, 400);

    // equipo y responsables solo de la organización
    const foreignMember = await fx.call(owner.token, 'PUT', '/inbox-settings', { members: [{ userId: stranger.id, capacity: 3, receives: true }] });
    assert.equal(errorCode(foreignMember), 'NOT_A_MEMBER');
    const foreignAgentR = await fx.call(owner.token, 'PUT', '/inbox-settings', { agentAssignees: [{ agentId: foreignAgent, userId: ana.id }] });
    assert.equal(errorCode(foreignAgentR), 'UNKNOWN_AGENT');
    const foreignPerson = await fx.call(owner.token, 'PUT', '/inbox-settings', { agentAssignees: [{ agentId: agent, userId: stranger.id }] });
    assert.equal(errorCode(foreignPerson), 'NOT_A_MEMBER');
    assert.equal((await fx.call(owner.token, 'PUT', '/inbox-settings', { members: [{ userId: ana.id, capacity: 101, receives: true }] })).status, 400);

    // guardar todo
    spy.reset();
    const hours = { '1': { open: '08:00', close: '18:00' }, '6': { open: '09:00', close: '14:00' }, '7': null };
    const ok = await fx.call(owner.token, 'PUT', '/inbox-settings', {
      assignmentMode: 'agent',
      keepLastPerson: true,
      businessHours: hours,
      outOfHoursNotice: true,
      responseGoalMinutes: 10,
      alertEmailMinutes: null,
      members: [{ userId: ana.id, capacity: 2, receives: false }],
      agentAssignees: [{ agentId: agent, userId: ana.id }],
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const saved = ok.json['settings'] as Record<string, unknown>;
    assert.equal(saved['assignmentMode'], 'agent');
    assert.equal(saved['keepLastPerson'], true);
    assert.deepEqual(saved['businessHours'], hours);
    assert.equal(saved['alertEmailMinutes'], null);
    const anaRow = (ok.json['team'] as Array<Record<string, unknown>>).find((m) => m['userId'] === ana.id)!;
    assert.equal(anaRow['capacity'], 2);
    assert.equal(anaRow['receives'], false);
    assert.deepEqual(ok.json['agentAssignees'], [{ agentId: agent, agentName: 'Ventas', userId: ana.id }]);
    assert.ok(spy.emits.some((e) => e.event === 'inbox-settings:changed' && e.rooms.includes(`org:${org}`)));
    // quitar el responsable y volver a siempre abierto
    const cleared = await fx.call(owner.token, 'PUT', '/inbox-settings', { businessHours: null, agentAssignees: [{ agentId: agent, userId: null }] });
    assert.equal((cleared.json['settings'] as Record<string, unknown>)['businessHours'], null);
    assert.deepEqual(cleared.json['agentAssignees'], [{ agentId: agent, agentName: 'Ventas', userId: null }]);
    // otra organización no ve estos ajustes
    const otherGet = await fx.call(stranger.token, 'GET', '/inbox-settings');
    assert.equal((otherGet.json['settings'] as Record<string, unknown>)['assignmentMode'], 'none');

    // Solo: lo ve, pero otro modo que none da 403
    const soloGet = await fx.call(soloOwner.token, 'GET', '/inbox-settings');
    assert.equal(soloGet.json['canTakeOver'], false);
    const soloPut = await fx.call(soloOwner.token, 'PUT', '/inbox-settings', { assignmentMode: 'rotating' });
    assert.equal(soloPut.status, 403);
    assert.equal(errorCode(soloPut), 'PLAN_LIMIT');
    assert.equal((await fx.call(soloOwner.token, 'PUT', '/inbox-settings', { responseGoalMinutes: 20 })).status, 200);
  } finally {
    await fx.cleanup();
  }
});
