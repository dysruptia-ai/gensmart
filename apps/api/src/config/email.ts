import nodemailer from 'nodemailer';
import { env } from './env';

interface UserInfo {
  name: string;
  email: string;
}

export function getFrontendUrl(): string {
  if (env.API_URL.includes('api.gensmart.co')) {
    return 'https://www.gensmart.co';
  }
  return env.API_URL.replace(':4000', ':3000');
}

const FRONTEND_URL = getFrontendUrl();

export function emailTemplate(content: string): string {
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

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'localhost',
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER
    ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
    : undefined,
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!env.SMTP_HOST) {
    console.log(`[Email] To: ${to} | Subject: ${subject} (SMTP not configured — skipping send)`);
    return;
  }
  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
}

export async function sendWelcomeEmail(user: UserInfo): Promise<void> {
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

export async function sendPasswordResetEmail(user: UserInfo, token: string): Promise<void> {
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

export async function sendInvitationEmail(
  inviterName: string,
  inviteeEmail: string,
  orgName: string,
  setupToken: string
): Promise<void> {
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

export async function sendHighScoreLeadEmail(
  user: UserInfo,
  leadInfo: { contactName: string; score: number; agentName: string; conversationUrl: string }
): Promise<void> {
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

export async function sendPlanLimitEmail(
  user: UserInfo,
  limitInfo: { percent: number; used: number; limit: number; planName: string }
): Promise<void> {
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
