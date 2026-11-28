/**
 * Correo de la meta de respuesta (web-45). En el cron de cada minuto: las conversaciones que "necesitan a
 * alguien" y llevan `alert_email_minutes` minutos de atención esperando reciben un aviso (notificación +
 * correo). Una vez por pedido: `wait_alert_sent_at` se compara con el comienzo de la espera actual.
 * Va a quien la tiene; si nadie la tiene, a owner y admin.
 */
import { businessMinutesBetween } from '@gensmart/shared';
import { query } from '../config/database';
import { getOrgTimezone } from './conversation-events.service';
import { INBOX_FROM, NEEDS_SQL, WAITING_SINCE_SQL } from './inbox-query.service';
import { rowToSettings, type InboxSettingsRow } from './inbox-settings.service';
import { createNotification } from './notification.service';

function alertText(language: string, contactName: string | null, minutes: number): { title: string; message: string } {
  const who = contactName?.trim();
  const m = Math.round(minutes);
  if (language === 'es') {
    return {
      title: who ? `${who} lleva ${m} min esperando` : `Una conversación lleva ${m} min esperando`,
      message: 'Pasó el tiempo de alerta de la meta de respuesta y nadie le respondió.',
    };
  }
  return {
    title: who ? `${who} has been waiting ${m} min` : `A conversation has been waiting ${m} min`,
    message: 'It passed the response goal alert time and nobody has replied.',
  };
}

/**
 * `onlyIds` y `sendEmail: false` son solo para los tests: limitan el cron a sus propias conversaciones y
 * no mandan correos reales (la plantilla tiene su propio test).
 */
export async function sendDueWaitAlerts(
  now: Date = new Date(),
  onlyIds?: readonly string[],
  opts: { sendEmail?: boolean } = {}
): Promise<number> {
  const orgs = await query<InboxSettingsRow & { organization_id: string }>(
    `SELECT organization_id, assignment_mode, keep_last_person, business_hours, out_of_hours_notice,
            response_goal_minutes, alert_email_minutes
     FROM inbox_settings WHERE alert_email_minutes IS NOT NULL`
  );
  let sent = 0;
  for (const org of orgs.rows) {
    const settings = rowToSettings(org);
    const alertMinutes = settings.alertEmailMinutes;
    if (alertMinutes === null) continue;
    const tz = (await getOrgTimezone(org.organization_id)) ?? 'UTC';
    // Prefiltro en minutos reales: los de atención nunca son más
    const due = await query<{
      id: string;
      status: string;
      taken_over_by: string | null;
      waiting_since: string;
      contact_name: string | null;
    }>(
      `SELECT c.id, c.status, c.taken_over_by, ${WAITING_SINCE_SQL} AS waiting_since, co.name AS contact_name
       ${INBOX_FROM}
       WHERE c.organization_id = $1 AND ${NEEDS_SQL}
         AND ${WAITING_SINCE_SQL} <= $2::timestamptz - make_interval(mins => $3)
         AND (c.wait_alert_sent_at IS NULL OR c.wait_alert_sent_at < ${WAITING_SINCE_SQL})
         AND ($4::uuid[] IS NULL OR c.id = ANY($4::uuid[]))
       LIMIT 500`,
      [org.organization_id, now.toISOString(), alertMinutes, onlyIds ? [...onlyIds] : null]
    );
    for (const conv of due.rows) {
      const waited = businessMinutesBetween(settings.businessHours, tz, new Date(conv.waiting_since), now);
      if (waited < alertMinutes) continue;
      // Una sola vez aunque corran dos crons a la vez
      const claimed = await query(
        `UPDATE conversations SET wait_alert_sent_at = $2
         WHERE id = $1 AND (wait_alert_sent_at IS NULL OR wait_alert_sent_at < $3::timestamptz)`,
        [conv.id, now.toISOString(), conv.waiting_since]
      );
      if ((claimed.rowCount ?? 0) === 0) continue;
      const holder = conv.status === 'human_takeover' ? conv.taken_over_by : null;
      const recipients = holder
        ? await query<{ id: string; language: string | null }>('SELECT id, language FROM users WHERE id = $1', [holder])
        : await query<{ id: string; language: string | null }>(
            `SELECT u.id, u.language FROM user_organizations uo JOIN users u ON u.id = uo.user_id
             WHERE uo.organization_id = $1 AND uo.role IN ('owner', 'admin')`,
            [org.organization_id]
          );
      for (const user of recipients.rows) {
        const text = alertText(user.language ?? 'en', conv.contact_name, waited);
        await createNotification({
          userId: user.id,
          organizationId: org.organization_id,
          type: 'inbox_wait_alert',
          title: text.title,
          message: text.message,
          data: { conversationId: conv.id, waitingMinutes: Math.round(waited), alertMinutes, contactName: conv.contact_name },
          sendEmail: opts.sendEmail !== false,
        }).catch((err: unknown) => console.error('[wait-alert] Failed to notify:', (err as Error).message));
      }
      sent++;
    }
  }
  return sent;
}
