/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-45): correo de la meta de respuesta.
 * Con INBOX_WAIT_ALERT_DB_TEST=1: una sola vez por pedido, el destinatario correcto y que fuera de
 * horario no cuente.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWait, inboxWaitAlertEmail } from '../emails';

test('plantilla inbox-wait-alert en ES y EN', () => {
  assert.equal(formatWait(45), '45 min');
  assert.equal(formatWait(65), '1 h 5 min');
  const es = inboxWaitAlertEmail({ name: 'Ana', waitingMinutes: 34, alertMinutes: 30, contactName: 'María', channelLabel: 'WhatsApp', conversationId: 'abc' }, 'es');
  assert.match(es.subject, /María lleva 34 min esperando/);
  assert.match(es.text, /Abrir la conversación/);
  assert.match(es.html, /\/dashboard\/conversations\/abc/);
  const en = inboxWaitAlertEmail({ name: 'Ana', waitingMinutes: 34, alertMinutes: 30, contactName: null, channelLabel: 'WhatsApp', conversationId: 'abc' }, 'en');
  assert.match(en.subject, /Unnamed contact has been waiting 34 min/);
});

const dbEnabled = process.env['INBOX_WAIT_ALERT_DB_TEST'] === '1';
const NO_EMAIL = { sendEmail: false };

test('sendDueWaitAlerts con la base', { skip: !dbEnabled }, async () => {
  const { startInboxFixture } = await import('./inbox-test-fixture');
  const { sendDueWaitAlerts } = await import('./inbox-wait-alert.service');
  const fx = await startInboxFixture('iwait');
  await fx.spyEmits();
  try {
    const org = await fx.makeOrg('pro');
    const owner = await fx.makeUser(org, 'Camila', 'owner');
    const admin = await fx.makeUser(org, 'Andrés', 'admin');
    const ana = await fx.makeUser(org, 'Ana', 'member');
    const agent = await fx.makeAgent(org);
    await fx.query(`UPDATE organizations SET settings = COALESCE(settings, '{}'::jsonb) || '{"timezone":"America/Bogota"}' WHERE id = $1`, [org]);
    await fx.query(`INSERT INTO inbox_settings (organization_id, response_goal_minutes, alert_email_minutes) VALUES ($1, 15, 30)`, [org]);

    const now = new Date();
    const waiting = async (minutesAgo: number, takenBy?: string) => {
      const id = await fx.makeConversation(org, agent, takenBy ? { takenBy, status: 'human_takeover' } : {});
      if (takenBy) {
        // tomada sin responder: espera desde el último mensaje del cliente
        await fx.query(`UPDATE messages SET created_at = NOW() - make_interval(mins => $2) WHERE conversation_id = $1`, [id, minutesAgo]);
      } else {
        await fx.query(`UPDATE conversations SET handed_off_at = NOW() - make_interval(mins => $2) WHERE id = $1`, [id, minutesAgo]);
      }
      return id;
    };
    const notifs = (convId: string) =>
      fx.query<{ user_id: string }>(
        `SELECT user_id FROM notifications WHERE type = 'inbox_wait_alert' AND data->>'conversationId' = $1 ORDER BY user_id`,
        [convId]
      );

    const unowned = await waiting(40);
    const owned = await waiting(40, ana.id);
    const early = await waiting(20);
    const ids = [unowned, owned, early];

    assert.equal(await sendDueWaitAlerts(now, ids, NO_EMAIL), 2);
    assert.deepEqual((await notifs(unowned)).rows.map((r) => r.user_id).sort(), [owner.id, admin.id].sort()); // nadie la tiene
    assert.deepEqual((await notifs(owned)).rows.map((r) => r.user_id), [ana.id]); // quien la tiene
    assert.equal((await notifs(early)).rows.length, 0);

    // una sola vez por pedido
    assert.equal(await sendDueWaitAlerts(now, ids, NO_EMAIL), 0);
    // un pedido nuevo vuelve a contar
    await fx.query(`UPDATE conversations SET handed_off_at = NOW() - interval '35 minutes' WHERE id = $1`, [unowned]);
    await fx.query(`UPDATE conversations SET wait_alert_sent_at = NOW() - interval '36 minutes' WHERE id = $1`, [unowned]);
    assert.equal(await sendDueWaitAlerts(now, [unowned], NO_EMAIL), 1);

    // fuera de horario no cuenta: un horario cerrado todo el tiempo salvo una ventana mínima ya pasada
    const closedAll = { '1': null, '2': null, '3': null, '4': null, '5': null, '6': null, '7': null };
    await fx.query(`UPDATE inbox_settings SET business_hours = $2 WHERE organization_id = $1`, [org, JSON.stringify(closedAll)]);
    const offHours = await waiting(120);
    assert.equal(await sendDueWaitAlerts(now, [offHours], NO_EMAIL), 0);
    assert.equal((await notifs(offHours)).rows.length, 0);
    // y abierto todo el día sí
    const openAll = Object.fromEntries(['1', '2', '3', '4', '5', '6', '7'].map((d) => [d, { open: '00:00', close: '23:59' }]));
    await fx.query(`UPDATE inbox_settings SET business_hours = $2 WHERE organization_id = $1`, [org, JSON.stringify(openAll)]);
    assert.equal(await sendDueWaitAlerts(now, [offHours], NO_EMAIL), 1);

    // sin alerta configurada no hace nada
    await fx.query(`UPDATE inbox_settings SET alert_email_minutes = NULL WHERE organization_id = $1`, [org]);
    const none = await waiting(90);
    assert.equal(await sendDueWaitAlerts(now, [none], NO_EMAIL), 0);
  } finally {
    await fx.cleanup();
  }
});
