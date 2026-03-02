import nodemailer from 'nodemailer';
import { env } from './env';

interface UserInfo {
  name: string;
  email: string;
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
    html: `
      <h1>Welcome, ${user.name}!</h1>
      <p>Your GenSmart account is ready. Start building AI agents in minutes.</p>
      <p><a href="${env.API_URL.replace(':4000', ':3000')}/dashboard">Go to Dashboard</a></p>
    `,
  });
}

export async function sendPasswordResetEmail(user: UserInfo, token: string): Promise<void> {
  const resetUrl = `${env.API_URL.replace(':4000', ':3000')}/reset-password/${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your GenSmart password',
    html: `
      <h1>Password Reset</h1>
      <p>Hi ${user.name},</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });
}

export async function sendInvitationEmail(
  inviterName: string,
  inviteeEmail: string,
  orgName: string,
  setupToken: string
): Promise<void> {
  const setupUrl = `${env.API_URL.replace(':4000', ':3000')}/reset-password/${setupToken}`;
  await sendEmail({
    to: inviteeEmail,
    subject: `You've been invited to join ${orgName} on GenSmart`,
    html: `
      <h1>You're Invited!</h1>
      <p>${inviterName} has invited you to join <strong>${orgName}</strong> on GenSmart.</p>
      <p>Click the link below to set up your account:</p>
      <p><a href="${setupUrl}">Accept Invitation</a></p>
      <p>This link expires in 24 hours.</p>
    `,
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
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; padding: 24px; border-radius: 12px;">
        <h1 style="color: #1A1A1A; font-size: 22px; margin-bottom: 8px;">High-Score Lead Alert</h1>
        <p style="color: #6B7280; margin-bottom: 24px;">Hi ${user.name}, a high-value lead has been identified by your agent.</p>
        <div style="background: #FFFFFF; border: 1px solid #E5E0DB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="color: #6B7280; font-size: 14px; padding: 4px 0;">Lead</td><td style="color: #1A1A1A; font-weight: 600; padding: 4px 0;">${contactName}</td></tr>
            <tr><td style="color: #6B7280; font-size: 14px; padding: 4px 0;">Score</td><td style="padding: 4px 0;"><span style="background: #25D366; color: white; font-weight: 700; padding: 2px 10px; border-radius: 12px;">${score}/10</span></td></tr>
            <tr><td style="color: #6B7280; font-size: 14px; padding: 4px 0;">Agent</td><td style="color: #1A1A1A; padding: 4px 0;">${agentName}</td></tr>
          </table>
        </div>
        <a href="${conversationUrl}" style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Conversation</a>
        <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">GenSmart — AI Conversational Agents Platform</p>
      </div>
    `,
  });
}

export async function sendPlanLimitEmail(
  user: UserInfo,
  limitInfo: { percent: number; used: number; limit: number; planName: string }
): Promise<void> {
  const { percent, used, limit, planName } = limitInfo;
  const frontendUrl = env.API_URL.replace(':4000', ':3000');
  const upgradeUrl = `${frontendUrl}/dashboard/billing`;
  const barColor = percent >= 100 ? '#EF4444' : '#F59E0B';

  await sendEmail({
    to: user.email,
    subject: `Plan Usage Alert: ${percent}% of messages used`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF8F5; padding: 24px; border-radius: 12px;">
        <h1 style="color: #1A1A1A; font-size: 22px; margin-bottom: 8px;">Usage Alert</h1>
        <p style="color: #6B7280; margin-bottom: 24px;">Hi ${user.name}, you've used ${percent}% of your ${planName} plan messages this month.</p>
        <div style="background: #FFFFFF; border: 1px solid #E5E0DB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #1A1A1A; font-weight: 600;">${used.toLocaleString()} messages used</span>
            <span style="color: #6B7280;">of ${limit.toLocaleString()}</span>
          </div>
          <div style="background: #E5E0DB; border-radius: 4px; height: 10px; overflow: hidden;">
            <div style="background: ${barColor}; height: 10px; width: ${Math.min(percent, 100)}%;"></div>
          </div>
          <p style="color: #6B7280; font-size: 14px; margin: 8px 0 0;">${percent}% used</p>
        </div>
        <a href="${upgradeUrl}" style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Upgrade Plan</a>
        <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">GenSmart — AI Conversational Agents Platform</p>
      </div>
    `,
  });
}
