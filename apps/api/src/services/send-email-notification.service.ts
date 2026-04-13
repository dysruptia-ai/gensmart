import { type ToolDefinition } from './llm.service';
import { query } from '../config/database';
import { sendEmail, emailTemplate, getFrontendUrl } from '../config/email';
import { redis } from '../config/redis';

// ── Rate limits ───────────────────────────────────────────────────────────────

export const EMAIL_NOTIF_RATE_LIMIT = {
  perConversation: {
    maxSends: 3,
    windowSeconds: 600, // 10 minutes
  },
  perTool: {
    maxSends: 50,
    windowSeconds: 3600, // 1 hour
  },
} as const;

// ── Email validation regex ────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Config schema ─────────────────────────────────────────────────────────────

export interface EmailNotificationToolConfig {
  recipientEmail: string;
  ccEmails?: string[];
  subject: string;
  bodyTemplate: string;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    description: string;
  }>;
  fromName?: string;
  replyTo?: string;
}

// ── Tool definition builder ───────────────────────────────────────────────────

export function buildEmailNotificationToolDef(
  toolName: string,
  toolDescription: string,
  config: EmailNotificationToolConfig
): ToolDefinition {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];

  for (const param of config.parameters || []) {
    if (!param.name) continue;
    properties[param.name] = {
      type: param.type || 'string',
      description: param.description || param.name,
    };
    if (param.required) required.push(param.name);
  }

  return {
    name: toolName.replace(/\s+/g, '_').toLowerCase(),
    description: [
      toolDescription,
      'IMPORTANT: Only call this tool when you have collected all required information from the user.',
      'Do not call it preemptively. After calling, continue the conversation naturally.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties,
      required,
    },
  };
}

// ── Template renderer ─────────────────────────────────────────────────────────

function renderTemplate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = params[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Context and result types ──────────────────────────────────────────────────

export interface SendEmailNotificationContext {
  conversationId: string;
  agentId: string;
  organizationId: string;
  toolId: string;
  toolName: string;
  config: EmailNotificationToolConfig;
}

export interface SendEmailNotificationResult {
  success: boolean;
  message: string;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleSendEmailNotification(
  args: Record<string, unknown>,
  context: SendEmailNotificationContext
): Promise<SendEmailNotificationResult> {
  const { config, toolId, conversationId } = context;

  // 1. Validate config
  if (!config.recipientEmail || !EMAIL_REGEX.test(config.recipientEmail)) {
    await logEmailNotif(context, 'rejected_validation', 'Invalid recipient email in tool config');
    return { success: false, message: 'Error: notification tool is misconfigured (invalid recipient email).' };
  }
  if (!config.subject || !config.bodyTemplate) {
    await logEmailNotif(context, 'rejected_validation', 'Missing subject or body template');
    return { success: false, message: 'Error: notification tool is misconfigured (missing subject or body).' };
  }

  // 2. Validate required parameters were provided by the LLM
  for (const param of config.parameters || []) {
    if (
      param.required &&
      (args[param.name] === undefined || args[param.name] === null || args[param.name] === '')
    ) {
      return {
        success: false,
        message: `Error: missing required parameter '${param.name}'. Please collect it from the user before calling this tool.`,
      };
    }
  }

  // 3. Rate limit per conversation (per tool instance)
  const convKey = `email_notif:rate:conv:${conversationId}:${toolId}`;
  const convCount = await redis.incr(convKey);
  if (convCount === 1) {
    await redis.expire(convKey, EMAIL_NOTIF_RATE_LIMIT.perConversation.windowSeconds);
  }
  if (convCount > EMAIL_NOTIF_RATE_LIMIT.perConversation.maxSends) {
    await logEmailNotif(
      context,
      'rejected_rate_limit',
      `Per-conversation limit exceeded (${EMAIL_NOTIF_RATE_LIMIT.perConversation.maxSends} per ${EMAIL_NOTIF_RATE_LIMIT.perConversation.windowSeconds}s)`
    );
    return {
      success: false,
      message:
        'Notification rate limit reached for this conversation. Continue without sending another notification.',
    };
  }

  // 4. Rate limit per tool instance
  const toolKey = `email_notif:rate:tool:${toolId}`;
  const toolCount = await redis.incr(toolKey);
  if (toolCount === 1) {
    await redis.expire(toolKey, EMAIL_NOTIF_RATE_LIMIT.perTool.windowSeconds);
  }
  if (toolCount > EMAIL_NOTIF_RATE_LIMIT.perTool.maxSends) {
    await logEmailNotif(
      context,
      'rejected_rate_limit',
      `Per-tool limit exceeded (${EMAIL_NOTIF_RATE_LIMIT.perTool.maxSends} per ${EMAIL_NOTIF_RATE_LIMIT.perTool.windowSeconds}s)`
    );
    return {
      success: false,
      message: 'Notification tool rate limit reached. Try again later.',
    };
  }

  // 5. Fetch conversation context for additional placeholders
  let conversationUrl = '';
  let contactName = '';
  let agentName = '';
  try {
    const convData = await query<{
      contact_name: string | null;
      agent_name: string;
    }>(
      `SELECT co.name AS contact_name, a.name AS agent_name
       FROM conversations c
       JOIN agents a ON a.id = c.agent_id
       LEFT JOIN contacts co ON co.id = c.contact_id
       WHERE c.id = $1`,
      [conversationId]
    );
    contactName = convData.rows[0]?.contact_name ?? 'Unknown contact';
    agentName = convData.rows[0]?.agent_name ?? 'Agent';
    conversationUrl = `${getFrontendUrl()}/dashboard/conversations/${conversationId}`;
  } catch (err) {
    console.warn('[email-notif] Failed to fetch conversation context:', err);
  }

  // 6. Build placeholder map (LLM args + system context)
  const placeholders: Record<string, unknown> = {
    ...args,
    contact_name: contactName,
    agent_name: agentName,
    conversation_url: conversationUrl,
    timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
  };

  // 7. Render subject and body
  const renderedSubject = renderTemplate(config.subject, placeholders);
  const renderedBody = renderTemplate(config.bodyTemplate, placeholders);

  // 8. Build the full HTML email using the standard GenSmart template
  const fullHtml = emailTemplate(`
    <h2 style="margin:0 0 16px;color:#1A1A1A;font-family:'Inter',sans-serif;">${escapeHtml(renderedSubject)}</h2>
    <div style="color:#374151;font-size:14px;line-height:1.6;font-family:'Inter',sans-serif;">
      ${renderedBody}
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E0DB;">
      <p style="color:#6B7280;font-size:12px;margin:0 0 8px;">
        This notification was sent automatically by your GenSmart agent <strong>${escapeHtml(agentName)}</strong>.
      </p>
      ${
        conversationUrl
          ? `<a href="${conversationUrl}" style="display:inline-block;background:#25D366;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
               View conversation in GenSmart
             </a>`
          : ''
      }
    </div>
  `);

  // 9. Send via Nodemailer/SMTP
  try {
    const fromAddress = config.fromName
      ? `${config.fromName} <${process.env['SMTP_FROM'] ?? 'noreply@gensmart.co'}>`
      : undefined;

    const result = await sendEmail({
      to: config.recipientEmail,
      cc: config.ccEmails,
      subject: renderedSubject,
      html: fullHtml,
      from: fromAddress,
      replyTo: config.replyTo,
    });

    const bodyPreview = renderedBody.replace(/<[^>]+>/g, '').slice(0, 500);
    await logEmailNotif(context, 'sent', undefined, bodyPreview, result.messageId ?? undefined);

    return {
      success: true,
      message: `Notification email sent successfully to ${config.recipientEmail}. Continue the conversation naturally and let the user know their request has been received.`,
    };
  } catch (err) {
    const errorMsg = (err as Error).message ?? 'Unknown error';
    await logEmailNotif(context, 'failed', errorMsg);
    return {
      success: false,
      message: `Could not send notification email: ${errorMsg}. Continue the conversation but inform the user there was a temporary issue.`,
    };
  }
}

// ── Internal logger ───────────────────────────────────────────────────────────

async function logEmailNotif(
  context: SendEmailNotificationContext,
  status: string,
  errorMessage?: string,
  bodyPreview?: string,
  smtpMessageId?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO email_notification_logs
       (conversation_id, agent_id, organization_id, tool_id, recipient_email, subject, body_preview, status, error_message, smtp_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        context.conversationId,
        context.agentId,
        context.organizationId,
        context.toolId,
        context.config.recipientEmail,
        context.config.subject,
        bodyPreview ?? null,
        status,
        errorMessage ?? null,
        smtpMessageId ?? null,
      ]
    );
  } catch (err) {
    console.error('[email-notif] Failed to log notification send:', err);
    // Non-fatal — don't break the user-facing flow
  }
}
