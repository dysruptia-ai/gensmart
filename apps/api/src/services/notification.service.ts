import { query } from '../config/database';
import { getIO } from '../config/websocket';
import { sendEmail } from '../config/email';
import { env } from '../config/env';

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  readAt: string | null;
  emailSent: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  organization_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  read_at: string | null;
  email_sent: boolean;
  created_at: string;
}

export interface CreateNotificationParams {
  userId?: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data: row.data,
    read: row.read,
    readAt: row.read_at,
    emailSent: row.email_sent,
    createdAt: row.created_at,
  };
}

type UserRow = { id: string; name: string; email: string; language: string };

async function getOrgUsers(organizationId: string): Promise<UserRow[]> {
  const result = await query<UserRow>(
    `SELECT id, name, email, COALESCE(language, 'en') AS language FROM users WHERE organization_id = $1`,
    [organizationId]
  );
  return result.rows;
}

export async function createNotification(
  params: CreateNotificationParams
): Promise<Notification> {
  const { userId, organizationId, type, title, message, data = {}, sendEmail: doSendEmail = false } = params;

  let targetUsers: UserRow[];

  if (userId) {
    const result = await query<UserRow>(
      `SELECT id, name, email, COALESCE(language, 'en') AS language FROM users WHERE id = $1`,
      [userId]
    );
    targetUsers = result.rows;
  } else {
    targetUsers = await getOrgUsers(organizationId);
  }

  if (targetUsers.length === 0) {
    // Fallback: create a notification without a user (shouldn't happen in practice)
    const result = await query<NotificationRow>(
      `INSERT INTO notifications (user_id, organization_id, type, title, message, data)
       VALUES (NULL, $1, $2, $3, $4, $5)
       RETURNING *`,
      [organizationId, type, title, message, JSON.stringify(data)]
    );
    const notif = rowToNotification(result.rows[0]!);
    emitNotification(organizationId, notif);
    return notif;
  }

  let lastNotif: Notification | null = null;

  for (const user of targetUsers) {
    const result = await query<NotificationRow>(
      `INSERT INTO notifications (user_id, organization_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.id, organizationId, type, title, message, JSON.stringify(data)]
    );
    const notif = rowToNotification(result.rows[0]!);
    lastNotif = notif;
    emitNotification(organizationId, notif);

    if (doSendEmail) {
      await sendNotificationEmail(user, type, title, message, data, user.language).catch((err) =>
        console.error('[notification] Failed to send email:', err)
      );
      await query(
        `UPDATE notifications SET email_sent = true WHERE id = $1`,
        [notif.id]
      ).catch(() => {/* ignore */});
    }
  }

  return lastNotif!;
}

function emitNotification(organizationId: string, notif: Notification): void {
  try {
    getIO().to(`org:${organizationId}`).emit('notification:new', {
      id: notif.id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      data: notif.data,
      createdAt: notif.createdAt,
    });
  } catch {
    // WebSocket might not be initialized in tests
  }
}

const EMAIL_STRINGS = {
  en: {
    highScoreLead: {
      subject: (score: string) => `High-Score Lead: Score ${score}/10`,
      heading: 'High-Score Lead Alert',
      greeting: (name: string) => `Hi ${name}, a new high-score lead has been detected.`,
      contactId: (id: string) => `Contact ID: ${id}`,
      cta: 'View Conversation',
    },
    planUsage100: {
      subject: 'Message limit reached — Upgrade your plan',
      heading: 'Message Limit Reached',
      greeting: (name: string) => `Hi ${name}, your organization has used all available messages for this month.`,
      used: (used: string, limit: string) => `${used} / ${limit} messages used`,
      percent: '100% of your plan limit used',
      body: 'Upgrade your plan or purchase add-on messages to continue processing conversations.',
      cta: 'Upgrade Plan',
    },
  },
  es: {
    highScoreLead: {
      subject: (score: string) => `Lead con alta puntuación: ${score}/10`,
      heading: 'Alerta de lead con alta puntuación',
      greeting: (name: string) => `Hola ${name}, se ha detectado un nuevo lead con alta puntuación.`,
      contactId: (id: string) => `ID de contacto: ${id}`,
      cta: 'Ver conversación',
    },
    planUsage100: {
      subject: 'Límite de mensajes alcanzado — Actualiza tu plan',
      heading: 'Límite de mensajes alcanzado',
      greeting: (name: string) => `Hola ${name}, tu organización ha usado todos los mensajes disponibles este mes.`,
      used: (used: string, limit: string) => `${used} / ${limit} mensajes usados`,
      percent: '100% del límite de tu plan usado',
      body: 'Actualiza tu plan o compra mensajes adicionales para seguir procesando conversaciones.',
      cta: 'Actualizar plan',
    },
  },
};

async function sendNotificationEmail(
  user: { name: string; email: string },
  type: string,
  title: string,
  _message: string,
  data: Record<string, unknown>,
  language = 'en'
): Promise<void> {
  const frontendUrl = env.API_URL.replace(':4000', ':3000');
  const lang = language === 'es' ? 'es' : 'en';
  const strings = EMAIL_STRINGS[lang];

  if (type === 'high_score_lead') {
    const contactId = data['contactId'] as string | undefined;
    const score = data['score'] as number | undefined;
    const conversationId = data['conversationId'] as string | undefined;
    const conversationUrl = conversationId
      ? `${frontendUrl}/dashboard/conversations/${conversationId}`
      : `${frontendUrl}/dashboard/contacts`;
    const s = strings.highScoreLead;

    await sendEmail({
      to: user.email,
      subject: s.subject(String(score ?? '?')),
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; padding: 24px; border-radius: 12px;">
          <h1 style="color: #1A1A1A; font-size: 22px; margin-bottom: 8px;">${s.heading}</h1>
          <p style="color: #6B7280; margin-bottom: 24px;">${s.greeting(user.name)}</p>
          <div style="background: #FFFFFF; border: 1px solid #E5E0DB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <span style="background: #25D366; color: white; font-size: 28px; font-weight: 700; padding: 8px 16px; border-radius: 8px;">${score ?? '?'}/10</span>
              <div>
                <p style="color: #1A1A1A; font-weight: 600; margin: 0;">${title}</p>
              </div>
            </div>
            ${contactId ? `<p style="color: #6B7280; font-size: 14px; margin: 0;">${s.contactId(contactId)}</p>` : ''}
          </div>
          <a href="${conversationUrl}" style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">${s.cta}</a>
          <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">GenSmart — AI Conversational Agents Platform</p>
        </div>
      `,
    });
  } else if (type === 'plan_usage_100') {
    const used = data['used'] as number | undefined;
    const limit = data['limit'] as number | undefined;
    const upgradeUrl = `${frontendUrl}/dashboard/billing`;
    const s = strings.planUsage100;

    await sendEmail({
      to: user.email,
      subject: s.subject,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; padding: 24px; border-radius: 12px;">
          <h1 style="color: #EF4444; font-size: 22px; margin-bottom: 8px;">${s.heading}</h1>
          <p style="color: #6B7280; margin-bottom: 24px;">${s.greeting(user.name)}</p>
          <div style="background: #FFFFFF; border: 1px solid #E5E0DB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="color: #1A1A1A; font-weight: 600; margin: 0 0 8px;">${s.used(String(used ?? '?'), String(limit ?? '?'))}</p>
            <div style="background: #E5E0DB; border-radius: 4px; height: 8px; overflow: hidden;">
              <div style="background: #EF4444; height: 8px; width: 100%;"></div>
            </div>
            <p style="color: #6B7280; font-size: 14px; margin: 8px 0 0;">${s.percent}</p>
          </div>
          <p style="color: #6B7280; margin-bottom: 16px;">${s.body}</p>
          <a href="${upgradeUrl}" style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">${s.cta}</a>
          <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">GenSmart — AI Conversational Agents Platform</p>
        </div>
      `,
    });
  }
}

export async function listNotifications(
  userId: string,
  orgId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ notifications: Notification[]; total: number }> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  const [dataResult, countResult] = await Promise.all([
    query<NotificationRow>(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, orgId, limit, offset]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND organization_id = $2`,
      [userId, orgId]
    ),
  ]);

  return {
    notifications: dataResult.rows.map(rowToNotification),
    total: parseInt(countResult.rows[0]?.count ?? '0', 10),
  };
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET read = true, read_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

export async function markAllAsRead(userId: string, orgId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `WITH updated AS (
       UPDATE notifications SET read = true, read_at = NOW()
       WHERE user_id = $1 AND organization_id = $2 AND read = false
       RETURNING id
     )
     SELECT COUNT(*) as count FROM updated`,
    [userId, orgId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function getUnreadCount(userId: string, orgId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications
     WHERE user_id = $1 AND organization_id = $2 AND read = false`,
    [userId, orgId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}
