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
