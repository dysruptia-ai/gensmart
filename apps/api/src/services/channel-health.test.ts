/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Bandeja (web-45): canal desconectado.
 * - Siempre: channelAuthErrorCode por canal.
 * - Con CHANNEL_HEALTH_DB_TEST=1: la primera falla se conserva, se limpia con un envío correcto o al
 *   reconectar, se notifica una sola vez, y channelIssues trae disconnected/expiring sin correo ni web.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelAuthErrorCode } from './channel-health.service';
import { TelegramApiError } from './telegram.service';

const graph190 = new Error(
  'WhatsApp API error: {"error":{"message":"Error validating access token: Session has expired","type":"OAuthException","code":190,"error_subcode":463}}'
);

test('channelAuthErrorCode: solo credenciales', () => {
  assert.equal(channelAuthErrorCode('whatsapp', graph190), '190');
  assert.equal(channelAuthErrorCode('facebook', new Error('Messenger API error: {"error":{"type":"OAuthException","code":190}}')), '190');
  assert.equal(channelAuthErrorCode('instagram', new Error('Instagram send text error: {"error":{"code":190}}')), '190');
  assert.equal(channelAuthErrorCode('whatsapp', new Error('WhatsApp API error: {"error":{"code":131047}}')), null); // ventana de 24 h
  assert.equal(channelAuthErrorCode('whatsapp', new Error('fetch failed')), null);
  assert.equal(channelAuthErrorCode('telegram', new TelegramApiError('sendMessage', 401, 'Unauthorized')), '401');
  assert.equal(channelAuthErrorCode('telegram', new TelegramApiError('sendMessage', 403, 'bot was blocked by the user')), null);
  assert.equal(channelAuthErrorCode('email', graph190), null);
  assert.equal(channelAuthErrorCode('web', graph190), null);
});

const dbEnabled = process.env['CHANNEL_HEALTH_DB_TEST'] === '1';

test('salud de canales con la base', { skip: !dbEnabled }, async () => {
  const { startInboxFixture } = await import('./inbox-test-fixture');
  const { clearChannelHealth, getChannelIssues, recordChannelAuthFailure, resetHealthCache } = await import('./channel-health.service');
  const fx = await startInboxFixture('ihealth');
  await fx.spyEmits();
  try {
    const org = await fx.makeOrg('pro');
    const owner = await fx.makeUser(org, 'Camila', 'owner');
    const admin = await fx.makeUser(org, 'Andrés', 'admin');
    const ana = await fx.makeUser(org, 'Ana', 'member');
    const agent = await fx.makeAgent(org, 'Ventas');
    const agentTg = await fx.makeAgent(org, 'Bot');
    const agentExp = await fx.makeAgent(org, 'Pronto');
    await fx.query(`UPDATE agents SET channels = '["web","whatsapp","email"]'::jsonb, whatsapp_config = '{"connected": true}'::jsonb WHERE id = $1`, [agent]);

    // primera falla: fija failing_since y avisa a owner y admin (una vez)
    await recordChannelAuthFailure(agent, 'whatsapp', '190');
    const first = await fx.query<{ failing_since: string; notified_at: string | null }>(
      `SELECT failing_since, notified_at FROM agent_channel_health WHERE agent_id = $1 AND channel = 'whatsapp'`,
      [agent]
    );
    assert.ok(first.rows[0]?.notified_at);
    await fx.query(`UPDATE agent_channel_health SET failing_since = NOW() - interval '1 day' WHERE agent_id = $1`, [agent]);
    await recordChannelAuthFailure(agent, 'whatsapp', '190');
    const second = await fx.query<{ age: boolean }>(
      `SELECT failing_since < NOW() - interval '23 hours' AS age FROM agent_channel_health WHERE agent_id = $1`,
      [agent]
    );
    assert.equal(second.rows[0]!.age, true); // se conserva la fecha de la primera falla
    const notified = await fx.query<{ user_id: string }>(
      `SELECT user_id FROM notifications WHERE organization_id = $1 AND type = 'channel_disconnected'`,
      [org]
    );
    assert.deepEqual(notified.rows.map((r) => r.user_id).sort(), [owner.id, admin.id].sort());
    assert.ok(!notified.rows.some((r) => r.user_id === ana.id));

    let issues = await getChannelIssues(org);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.kind, 'disconnected');
    assert.equal(issues[0]!.channel, 'whatsapp');
    assert.ok(issues[0]!.since);

    // un envío correcto la limpia
    resetHealthCache();
    await clearChannelHealth(agent, 'whatsapp');
    assert.equal((await getChannelIssues(org)).length, 0);

    // canal activo con connected: false → desconectado sin fecha; correo y web no entran
    await fx.query(
      `UPDATE agents SET channels = '["telegram","email","web"]'::jsonb, telegram_config = '{"connected": false}'::jsonb,
              email_config = '{"connected": false}'::jsonb WHERE id = $1`,
      [agentTg]
    );
    // vence en 3 días
    await fx.query(
      `UPDATE agents SET channels = '["whatsapp"]'::jsonb,
              whatsapp_config = jsonb_build_object('connected', true, 'token_expires_at', (NOW() + interval '3 days')::text)
       WHERE id = $1`,
      [agentExp]
    );
    issues = await getChannelIssues(org);
    assert.deepEqual(
      issues.map((i) => [i.agentName, i.channel, i.kind, !!i.since, !!i.expiresAt]),
      [
        ['Bot', 'telegram', 'disconnected', false, false],
        ['Pronto', 'whatsapp', 'expiring', false, true],
      ]
    );
    // vence en 30 días: no aparece
    await fx.query(
      `UPDATE agents SET whatsapp_config = jsonb_build_object('connected', true, 'token_expires_at', (NOW() + interval '30 days')::text) WHERE id = $1`,
      [agentExp]
    );
    assert.equal((await getChannelIssues(org)).filter((i) => i.kind === 'expiring').length, 0);

    // reconectar limpia (la ruta llama a clearChannelHealth); el aviso se vuelve a mandar en una falla nueva
    await recordChannelAuthFailure(agentTg, 'telegram', '401');
    assert.equal((await getChannelIssues(org)).filter((i) => i.agentId === agentTg && i.since).length, 1);
    await clearChannelHealth(agentTg, 'telegram');
    const left = await fx.query(`SELECT 1 FROM agent_channel_health WHERE agent_id = $1`, [agentTg]);
    assert.equal(left.rows.length, 0);

    // counts expone channelIssues
    const counts = await fx.call(ana.token, 'GET', '/conversations/counts');
    assert.equal(counts.status, 200);
    assert.ok(Array.isArray(counts.json['channelIssues']));
    assert.ok('oldestWaitingSince' in counts.json);
  } finally {
    await fx.cleanup();
  }
});
