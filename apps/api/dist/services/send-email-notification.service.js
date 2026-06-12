"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_NOTIF_RATE_LIMIT = void 0;
exports.buildEmailNotificationToolDef = buildEmailNotificationToolDef;
exports.handleSendEmailNotification = handleSendEmailNotification;
const database_1 = require("../config/database");
const email_1 = require("../config/email");
const redis_1 = require("../config/redis");
// ── Rate limits ───────────────────────────────────────────────────────────────
exports.EMAIL_NOTIF_RATE_LIMIT = {
    perConversation: {
        maxSends: 3,
        windowSeconds: 600, // 10 minutes
    },
    perTool: {
        maxSends: 50,
        windowSeconds: 3600, // 1 hour
    },
};
// ── Email validation regex ────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// ── Tool definition builder ───────────────────────────────────────────────────
function buildEmailNotificationToolDef(toolName, toolDescription, config) {
    const properties = {};
    const required = [];
    for (const param of config.parameters || []) {
        if (!param.name)
            continue;
        properties[param.name] = {
            type: param.type || 'string',
            description: param.description || param.name,
        };
        if (param.required)
            required.push(param.name);
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
function renderTemplate(template, params) {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
        const val = params[key];
        if (val === undefined || val === null)
            return '';
        return String(val);
    });
}
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
// ── Main handler ──────────────────────────────────────────────────────────────
async function handleSendEmailNotification(args, context) {
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
        if (param.required &&
            (args[param.name] === undefined || args[param.name] === null || args[param.name] === '')) {
            return {
                success: false,
                message: `Error: missing required parameter '${param.name}'. Please collect it from the user before calling this tool.`,
            };
        }
    }
    // 3. Rate limit per conversation (per tool instance)
    const convKey = `email_notif:rate:conv:${conversationId}:${toolId}`;
    const convCount = await redis_1.redis.incr(convKey);
    if (convCount === 1) {
        await redis_1.redis.expire(convKey, exports.EMAIL_NOTIF_RATE_LIMIT.perConversation.windowSeconds);
    }
    if (convCount > exports.EMAIL_NOTIF_RATE_LIMIT.perConversation.maxSends) {
        await logEmailNotif(context, 'rejected_rate_limit', `Per-conversation limit exceeded (${exports.EMAIL_NOTIF_RATE_LIMIT.perConversation.maxSends} per ${exports.EMAIL_NOTIF_RATE_LIMIT.perConversation.windowSeconds}s)`);
        return {
            success: false,
            message: 'Notification rate limit reached for this conversation. Continue without sending another notification.',
        };
    }
    // 4. Rate limit per tool instance
    const toolKey = `email_notif:rate:tool:${toolId}`;
    const toolCount = await redis_1.redis.incr(toolKey);
    if (toolCount === 1) {
        await redis_1.redis.expire(toolKey, exports.EMAIL_NOTIF_RATE_LIMIT.perTool.windowSeconds);
    }
    if (toolCount > exports.EMAIL_NOTIF_RATE_LIMIT.perTool.maxSends) {
        await logEmailNotif(context, 'rejected_rate_limit', `Per-tool limit exceeded (${exports.EMAIL_NOTIF_RATE_LIMIT.perTool.maxSends} per ${exports.EMAIL_NOTIF_RATE_LIMIT.perTool.windowSeconds}s)`);
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
        const convData = await (0, database_1.query)(`SELECT co.name AS contact_name, a.name AS agent_name
       FROM conversations c
       JOIN agents a ON a.id = c.agent_id
       LEFT JOIN contacts co ON co.id = c.contact_id
       WHERE c.id = $1`, [conversationId]);
        contactName = convData.rows[0]?.contact_name ?? 'Unknown contact';
        agentName = convData.rows[0]?.agent_name ?? 'Agent';
        conversationUrl = `${(0, email_1.getFrontendUrl)()}/dashboard/conversations/${conversationId}`;
    }
    catch (err) {
        console.warn('[email-notif] Failed to fetch conversation context:', err);
    }
    // 6. Build placeholder map (LLM args + system context)
    const placeholders = {
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
    const fullHtml = (0, email_1.emailTemplate)(`
    <h2 style="margin:0 0 16px;color:#1A1A1A;font-family:'Inter',sans-serif;">${escapeHtml(renderedSubject)}</h2>
    <div style="color:#374151;font-size:14px;line-height:1.6;font-family:'Inter',sans-serif;">
      ${renderedBody}
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E5E0DB;">
      <p style="color:#6B7280;font-size:12px;margin:0 0 8px;">
        This notification was sent automatically by your GenSmart agent <strong>${escapeHtml(agentName)}</strong>.
      </p>
      ${conversationUrl
        ? `<a href="${conversationUrl}" style="display:inline-block;background:#25D366;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
               View conversation in GenSmart
             </a>`
        : ''}
    </div>
  `);
    // 9. Send via Nodemailer/SMTP
    try {
        const fromAddress = config.fromName
            ? `${config.fromName} <${process.env['SMTP_FROM'] ?? 'noreply@gensmart.co'}>`
            : undefined;
        const result = await (0, email_1.sendEmail)({
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
    }
    catch (err) {
        const errorMsg = err.message ?? 'Unknown error';
        await logEmailNotif(context, 'failed', errorMsg);
        return {
            success: false,
            message: `Could not send notification email: ${errorMsg}. Continue the conversation but inform the user there was a temporary issue.`,
        };
    }
}
// ── Internal logger ───────────────────────────────────────────────────────────
async function logEmailNotif(context, status, errorMessage, bodyPreview, smtpMessageId) {
    try {
        await (0, database_1.query)(`INSERT INTO email_notification_logs
       (conversation_id, agent_id, organization_id, tool_id, recipient_email, subject, body_preview, status, error_message, smtp_message_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
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
        ]);
    }
    catch (err) {
        console.error('[email-notif] Failed to log notification send:', err);
        // Non-fatal — don't break the user-facing flow
    }
}
//# sourceMappingURL=send-email-notification.service.js.map