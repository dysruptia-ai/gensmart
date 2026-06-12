"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFrontendUrl = getFrontendUrl;
exports.emailTemplate = emailTemplate;
exports.sendEmail = sendEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendInvitationEmail = sendInvitationEmail;
exports.sendHighScoreLeadEmail = sendHighScoreLeadEmail;
exports.sendPlanLimitEmail = sendPlanLimitEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("./env");
function getFrontendUrl() {
    if (env_1.env.API_URL.includes('api.gensmart.co')) {
        return 'https://www.gensmart.co';
    }
    return env_1.env.API_URL.replace(':4000', ':3000');
}
const FRONTEND_URL = getFrontendUrl();
function emailTemplate(content) {
    return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; border-radius: 12px; overflow: hidden;">
      <div style="background: #FFFFFF; padding: 24px 32px; border-bottom: 3px solid #25D366; text-align: center;">
        <a href="${FRONTEND_URL}" style="text-decoration: none;">
          <span style="font-family: 'Handjet', 'Courier New', monospace; font-size: 32px; font-weight: 700;">
            <span style="color: #1A1A1A;">Gen</span><span style="color: #25D366;">Smart</span>
          </span>
        </a>
      </div>
      <div style="padding: 32px;">
        ${content}
      </div>
      <div style="padding: 16px 32px; text-align: center; border-top: 1px solid #E5E0DB;">
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          &copy; 2026 Dysruptia LLC. All rights reserved.<br/>
          <a href="${FRONTEND_URL}" style="color: #9CA3AF;">www.gensmart.co</a>
        </p>
      </div>
    </div>
  `;
}
const transporter = nodemailer_1.default.createTransport({
    host: env_1.env.SMTP_HOST || 'localhost',
    port: env_1.env.SMTP_PORT,
    secure: env_1.env.SMTP_PORT === 465,
    auth: env_1.env.SMTP_USER
        ? { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS }
        : undefined,
});
async function sendEmail({ to, subject, html, cc, from, replyTo, }) {
    if (!env_1.env.SMTP_HOST) {
        console.log(`[Email] To: ${to} | Subject: ${subject} (SMTP not configured — skipping send)`);
        return { messageId: null };
    }
    const info = await transporter.sendMail({
        from: from ?? env_1.env.SMTP_FROM,
        to,
        cc,
        replyTo,
        subject,
        html,
    });
    return { messageId: info.messageId ?? null };
}
async function sendWelcomeEmail(user) {
    await sendEmail({
        to: user.email,
        subject: 'Welcome to GenSmart!',
        html: emailTemplate(`
      <h1 style="color: #1A1A1A; font-size: 24px; margin-bottom: 8px;">Welcome, ${user.name}!</h1>
      <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Your GenSmart account is ready. Start building AI agents in minutes.</p>
      <p style="margin-top: 24px;">
        <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; background: #25D366; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
      </p>
    `),
    });
}
async function sendPasswordResetEmail(user, token) {
    const resetUrl = `${FRONTEND_URL}/reset-password/${token}`;
    await sendEmail({
        to: user.email,
        subject: 'Reset your GenSmart password',
        html: emailTemplate(`
      <h1 style="color: #1A1A1A; font-size: 24px; margin-bottom: 8px;">Password Reset</h1>
      <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Hi ${user.name},</p>
      <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Click the button below to reset your password. This link expires in 1 hour.</p>
      <p style="margin-top: 24px;">
        <a href="${resetUrl}" style="display: inline-block; background: #25D366; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
      </p>
      <p style="color: #6B7280; font-size: 14px; margin-top: 24px;">If you didn't request this, please ignore this email.</p>
    `),
    });
}
async function sendInvitationEmail(inviterName, inviteeEmail, orgName, setupToken) {
    const setupUrl = `${FRONTEND_URL}/reset-password/${setupToken}`;
    await sendEmail({
        to: inviteeEmail,
        subject: `You've been invited to join ${orgName} on GenSmart`,
        html: emailTemplate(`
      <h1 style="color: #1A1A1A; font-size: 24px; margin-bottom: 8px;">You're Invited!</h1>
      <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">${inviterName} has invited you to join <strong>${orgName}</strong> on GenSmart.</p>
      <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Click the button below to set up your account:</p>
      <p style="margin-top: 24px;">
        <a href="${setupUrl}" style="display: inline-block; background: #25D366; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Accept Invitation</a>
      </p>
      <p style="color: #6B7280; font-size: 14px; margin-top: 24px;">This link expires in 24 hours.</p>
    `),
    });
}
async function sendHighScoreLeadEmail(user, leadInfo) {
    const { contactName, score, agentName, conversationUrl } = leadInfo;
    await sendEmail({
        to: user.email,
        subject: `High-Score Lead: ${contactName} scored ${score}/10`,
        html: emailTemplate(`
      <h1 style="color: #1A1A1A; font-size: 24px; margin-bottom: 8px;">High-Score Lead Alert</h1>
      <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Hi ${user.name}, a high-value lead has been identified by your agent.</p>
      <div style="background: #FFFFFF; border: 1px solid #E5E0DB; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="color: #6B7280; font-size: 14px; padding: 4px 0;">Lead</td><td style="color: #1A1A1A; font-weight: 600; padding: 4px 0;">${contactName}</td></tr>
          <tr><td style="color: #6B7280; font-size: 14px; padding: 4px 0;">Score</td><td style="padding: 4px 0;"><span style="background: #25D366; color: white; font-weight: 700; padding: 2px 10px; border-radius: 12px;">${score}/10</span></td></tr>
          <tr><td style="color: #6B7280; font-size: 14px; padding: 4px 0;">Agent</td><td style="color: #1A1A1A; padding: 4px 0;">${agentName}</td></tr>
        </table>
      </div>
      <p style="margin-top: 24px;">
        <a href="${conversationUrl}" style="display: inline-block; background: #25D366; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Lead</a>
      </p>
    `),
    });
}
async function sendPlanLimitEmail(user, limitInfo) {
    const { percent, used, limit, planName } = limitInfo;
    const upgradeUrl = `${FRONTEND_URL}/dashboard/billing`;
    const barColor = percent >= 100 ? '#EF4444' : '#F59E0B';
    await sendEmail({
        to: user.email,
        subject: `Plan Usage Alert: ${percent}% of messages used`,
        html: emailTemplate(`
      <h1 style="color: #1A1A1A; font-size: 24px; margin-bottom: 8px;">Usage Alert</h1>
      <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Hi ${user.name}, you've used ${percent}% of your ${planName} plan messages this month.</p>
      <div style="background: #FFFFFF; border: 1px solid #E5E0DB; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #1A1A1A; font-weight: 600;">${used.toLocaleString()} messages used</span>
          <span style="color: #6B7280;">of ${limit.toLocaleString()}</span>
        </div>
        <div style="background: #E5E0DB; border-radius: 4px; height: 10px; overflow: hidden;">
          <div style="background: ${barColor}; height: 10px; width: ${Math.min(percent, 100)}%;"></div>
        </div>
        <p style="color: #6B7280; font-size: 14px; margin: 8px 0 0;">${percent}% used</p>
      </div>
      <p style="margin-top: 24px;">
        <a href="${upgradeUrl}" style="display: inline-block; background: #25D366; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Upgrade Plan</a>
      </p>
    `),
    });
}
//# sourceMappingURL=email.js.map