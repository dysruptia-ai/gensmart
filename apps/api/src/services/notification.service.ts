import { query } from '../config/database';
import { getIO } from '../config/websocket';
import { sendRendered } from '../config/email';
import { highScoreLeadEmail, inboxWaitAlertEmail, orgSuspendedEmail, planLimitEmail, toEmailLang } from '../emails';
import { displayName } from '../emails/parts';

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
    emitNotification(`org:${organizationId}`, notif);
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
    emitNotification(`user:${user.id}`, notif);

    if (doSendEmail) {
      await sendNotificationEmail(user, organizationId, type, data, user.language).catch((err) =>
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

function emitNotification(room: string, notif: Notification): void {
  try {
    getIO().to(room).emit('notification:new', {
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

/** Nombre legible del canal de una conversación, para el correo del lead. */
const CHANNEL_LABELS: Record<string, { es: string; en: string }> = {
  whatsapp: { es: 'WhatsApp', en: 'WhatsApp' },
  web: { es: 'Sitio web', en: 'Website' },
  email: { es: 'Correo', en: 'Email' },
  instagram: { es: 'Instagram', en: 'Instagram' },
  messenger: { es: 'Messenger', en: 'Messenger' },
  facebook: { es: 'Messenger', en: 'Messenger' },
  telegram: { es: 'Telegram', en: 'Telegram' },
};

async function loadLeadContext(
  organizationId: string,
  contactId: string | undefined,
  conversationId: string | undefined
): Promise<{ contactName: string | null; agentName: string | null; channel: string | null }> {
  const contact = contactId
    ? await query<{ name: string | null }>('SELECT name FROM contacts WHERE id = $1 AND organization_id = $2', [
        contactId,
        organizationId,
      ])
    : null;
  const conv = conversationId
    ? await query<{ agent_name: string | null; channel: string | null }>(
        `SELECT a.name AS agent_name, c.channel
         FROM conversations c LEFT JOIN agents a ON a.id = c.agent_id
         WHERE c.id = $1 AND c.organization_id = $2`,
        [conversationId, organizationId]
      )
    : null;
  return {
    contactName: contact?.rows[0]?.name ?? null,
    agentName: conv?.rows[0]?.agent_name ?? null,
    channel: conv?.rows[0]?.channel ?? null,
  };
}

async function loadOrgName(organizationId: string): Promise<string> {
  const org = await query<{ name: string }>('SELECT name FROM organizations WHERE id = $1', [organizationId]);
  return org.rows[0]?.name ?? 'GenSmart';
}

async function sendNotificationEmail(
  user: { name: string; email: string },
  organizationId: string,
  type: string,
  data: Record<string, unknown>,
  language: string
): Promise<void> {
  const lang = toEmailLang(language);
  const name = displayName(user.name, user.email);

  if (type === 'high_score_lead') {
    const contactId = typeof data['contactId'] === 'string' ? data['contactId'] : undefined;
    const conversationId = typeof data['conversationId'] === 'string' ? data['conversationId'] : undefined;
    const ctx = await loadLeadContext(organizationId, contactId, conversationId);
    const channel = ctx.channel ? CHANNEL_LABELS[ctx.channel]?.[lang] ?? null : null;
    await sendRendered(
      user.email,
      highScoreLeadEmail(
        {
          name,
          score: typeof data['score'] === 'number' ? data['score'] : null,
          contactName: ctx.contactName,
          service: typeof data['service'] === 'string' ? data['service'] : null,
          agentName: ctx.agentName,
          channelLabel: channel,
          conversationId,
        },
        lang
      )
    );
  } else if (type === 'inbox_wait_alert') {
    const conversationId = typeof data['conversationId'] === 'string' ? data['conversationId'] : null;
    if (!conversationId) return;
    const ctx = await loadLeadContext(organizationId, undefined, conversationId);
    await sendRendered(
      user.email,
      inboxWaitAlertEmail(
        {
          name,
          waitingMinutes: typeof data['waitingMinutes'] === 'number' ? data['waitingMinutes'] : 0,
          alertMinutes: typeof data['alertMinutes'] === 'number' ? data['alertMinutes'] : 0,
          contactName: typeof data['contactName'] === 'string' ? data['contactName'] : null,
          agentName: ctx.agentName,
          channelLabel: (ctx.channel ? CHANNEL_LABELS[ctx.channel]?.[lang] : null) ?? ctx.channel ?? '',
          conversationId,
        },
        lang
      )
    );
  } else if (type === 'plan_usage_100') {
    const used = typeof data['used'] === 'number' ? data['used'] : null;
    const limit = typeof data['limit'] === 'number' ? data['limit'] : null;
    await sendRendered(user.email, planLimitEmail({ name, organizationName: await loadOrgName(organizationId), used, limit }, lang));
  } else if (type === 'org_suspended') {
    const reason = data['reason'] === 'trial_expired' ? 'trial_expired' : 'subscription_cancelled';
    await sendRendered(
      user.email,
      orgSuspendedEmail({ name, organizationName: await loadOrgName(organizationId), reason }, lang)
    );
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
