/**
 * Canal desconectado (web-45). Un envío que falla por credenciales (token vencido o revocado) deja una
 * fila en agent_channel_health; un envío correcto o reconectar el canal la borra. La primera vez se
 * avisa a owner y admin. No cambia los reintentos: solo observa el resultado del envío.
 */
import { query } from '../config/database';
import { createNotification } from './notification.service';
import { TelegramApiError } from './telegram.service';

export type HealthChannel = 'whatsapp' | 'facebook' | 'instagram' | 'telegram';
export const HEALTH_CHANNELS: readonly HealthChannel[] = ['whatsapp', 'facebook', 'instagram', 'telegram'];

/** La columna de configuración de cada canal en `agents`. */
export const CHANNEL_CONFIG_COLUMN: Record<HealthChannel, string> = {
  whatsapp: 'whatsapp_config',
  facebook: 'facebook_config',
  instagram: 'instagram_config',
  telegram: 'telegram_config',
};

/**
 * El código si el error es de credenciales; null si es otro (red, límite, destinatario…).
 * - WhatsApp, Messenger, Instagram: Graph `code: 190` (OAuthException: token inválido, vencido o revocado).
 *   "messaging-disabled" de Instagram NO cuenta: es un ajuste del cliente, no del canal.
 * - Telegram: 401 Unauthorized (token del bot revocado).
 */
export function channelAuthErrorCode(channel: string, err: unknown): string | null {
  if (channel === 'telegram') {
    if (err instanceof TelegramApiError && err.errorCode === 401) return '401';
    return null;
  }
  if (channel !== 'whatsapp' && channel !== 'facebook' && channel !== 'instagram') return null;
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  // Los servicios lanzan `… error: {"error":{"message":…,"type":"OAuthException","code":190,…}}`
  const json = message.slice(message.indexOf('{'));
  try {
    const parsed = JSON.parse(json) as { error?: { code?: number } };
    if (parsed.error?.code === 190) return '190';
  } catch {
    if (/"code"\s*:\s*190\b/.test(message)) return '190';
  }
  return null;
}

/** Agentes+canal que sabemos sanos: evita un DELETE por cada mensaje enviado. */
const healthy = new Set<string>();
const key = (agentId: string, channel: string) => `${agentId}:${channel}`;

/** Solo para los tests. */
export function resetHealthCache(): void {
  healthy.clear();
}

function notifyText(language: string, agentName: string, channel: HealthChannel): { title: string; message: string } {
  const names: Record<HealthChannel, string> = { whatsapp: 'WhatsApp', facebook: 'Messenger', instagram: 'Instagram', telegram: 'Telegram' };
  const ch = names[channel];
  if (language === 'es') {
    return {
      title: `${ch} de ${agentName} se desconectó`,
      message: 'Las respuestas no están saliendo. Reconecta el canal desde los ajustes del agente.',
    };
  }
  return {
    title: `${agentName}'s ${ch} got disconnected`,
    message: "Replies aren't going out. Reconnect the channel from the agent's settings.",
  };
}

export async function recordChannelAuthFailure(agentId: string, channel: HealthChannel, code: string): Promise<void> {
  healthy.delete(key(agentId, channel));
  const r = await query<{ organization_id: string; agent_name: string; notified_at: string | null }>(
    `WITH up AS (
       INSERT INTO agent_channel_health (agent_id, channel, organization_id, failing_since, last_error_code, last_error_at)
       SELECT a.id, $2, a.organization_id, NOW(), $3, NOW() FROM agents a WHERE a.id = $1
       ON CONFLICT (agent_id, channel) DO UPDATE SET last_error_code = EXCLUDED.last_error_code, last_error_at = NOW()
       RETURNING organization_id, notified_at
     )
     SELECT up.organization_id, a.name AS agent_name, up.notified_at FROM up JOIN agents a ON a.id = $1`,
    [agentId, channel, code]
  );
  const row = r.rows[0];
  if (!row || row.notified_at) return;
  // Una sola vez: el UPDATE condicional gana aunque haya dos fallas a la vez
  const claimed = await query(
    `UPDATE agent_channel_health SET notified_at = NOW() WHERE agent_id = $1 AND channel = $2 AND notified_at IS NULL`,
    [agentId, channel]
  );
  if ((claimed.rowCount ?? 0) === 0) return;
  const admins = await query<{ id: string; language: string | null }>(
    `SELECT u.id, u.language FROM user_organizations uo JOIN users u ON u.id = uo.user_id
     WHERE uo.organization_id = $1 AND uo.role IN ('owner', 'admin')`,
    [row.organization_id]
  );
  for (const admin of admins.rows) {
    const text = notifyText(admin.language ?? 'en', row.agent_name, channel);
    await createNotification({
      userId: admin.id,
      organizationId: row.organization_id,
      type: 'channel_disconnected',
      title: text.title,
      message: text.message,
      data: { agentId, channel, code },
      sendEmail: false,
    }).catch((err: unknown) => console.error('[channel-health] Failed to notify:', (err as Error).message));
  }
}

export async function clearChannelHealth(agentId: string, channel: HealthChannel): Promise<void> {
  const k = key(agentId, channel);
  if (healthy.has(k)) return;
  await query('DELETE FROM agent_channel_health WHERE agent_id = $1 AND channel = $2', [agentId, channel]);
  healthy.add(k);
}

/** Para los envíos: nunca falla a quien lo llama. */
export function observeSend(agentId: string, channel: string, err: unknown | null): void {
  if (!(HEALTH_CHANNELS as readonly string[]).includes(channel)) return;
  const ch = channel as HealthChannel;
  const run = async () => {
    if (err === null) return clearChannelHealth(agentId, ch);
    const code = channelAuthErrorCode(ch, err);
    if (code) await recordChannelAuthFailure(agentId, ch, code);
  };
  void run().catch((e: unknown) => console.error('[channel-health] failed:', (e as Error).message));
}

export interface ChannelIssue {
  agentId: string;
  agentName: string;
  channel: HealthChannel;
  kind: 'disconnected' | 'expiring';
  since?: string;
  expiresAt?: string;
}

export const EXPIRING_DAYS = 7;

/**
 * Los avisos de canal de la Bandeja: `disconnected` (una fila de salud, o un canal activo con
 * `connected: false`, sin fecha) y `expiring` (token de WhatsApp que vence en 7 días o menos).
 * Correo y web no entran.
 */
export async function getChannelIssues(organizationId: string): Promise<ChannelIssue[]> {
  const r = await query<{
    agent_id: string;
    agent_name: string;
    channel: HealthChannel;
    kind: 'disconnected' | 'expiring';
    since: string | null;
    expires_at: string | null;
  }>(
    `SELECT h.agent_id, a.name AS agent_name, h.channel, 'disconnected' AS kind, h.failing_since AS since, NULL AS expires_at
     FROM agent_channel_health h JOIN agents a ON a.id = h.agent_id
     WHERE h.organization_id = $1
     UNION ALL
     SELECT a.id, a.name, ch.channel, 'disconnected', NULL, NULL
     FROM agents a
     CROSS JOIN LATERAL (VALUES
       ('whatsapp', a.whatsapp_config), ('facebook', a.facebook_config),
       ('instagram', a.instagram_config), ('telegram', a.telegram_config)
     ) AS ch(channel, cfg)
     WHERE a.organization_id = $1
       AND a.channels ? ch.channel
       AND ch.cfg IS NOT NULL AND ch.cfg ? 'connected' AND (ch.cfg->>'connected') = 'false'
       AND NOT EXISTS (SELECT 1 FROM agent_channel_health h2 WHERE h2.agent_id = a.id AND h2.channel = ch.channel)
     UNION ALL
     SELECT a.id, a.name, 'whatsapp', 'expiring', NULL, a.whatsapp_config->>'token_expires_at'
     FROM agents a
     WHERE a.organization_id = $1
       AND a.channels ? 'whatsapp'
       AND COALESCE(a.whatsapp_config->>'connected', 'true') <> 'false'
       AND COALESCE(a.whatsapp_config->>'token_expires_at', '') <> ''
       AND (a.whatsapp_config->>'token_expires_at')::timestamptz <= NOW() + make_interval(days => ${EXPIRING_DAYS})
       AND NOT EXISTS (SELECT 1 FROM agent_channel_health h3 WHERE h3.agent_id = a.id AND h3.channel = 'whatsapp')
     ORDER BY 2, 3`,
    [organizationId]
  );
  return r.rows.map((row) => ({
    agentId: row.agent_id,
    agentName: row.agent_name,
    channel: row.channel,
    kind: row.kind,
    ...(row.since ? { since: new Date(row.since).toISOString() } : {}),
    ...(row.expires_at ? { expiresAt: new Date(row.expires_at).toISOString() } : {}),
  }));
}
