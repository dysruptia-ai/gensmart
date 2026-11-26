/**
 * Transporte SMTP, `sendEmail` y funciones finas que arman cada correo con `emails/` y lo mandan.
 * El HTML y los textos viven en `src/emails/`.
 */
import nodemailer from 'nodemailer';
import { env } from './env';
import {
  accountLinkedEmail,
  htmlToText,
  invitationEmail,
  orgAccessEmail,
  passwordResetEmail,
  toEmailLang,
  verifyEmail,
  welcomeEmail,
  type EmailRecipient,
  type RenderedEmail,
} from '../emails';
import { displayName } from '../emails/parts';

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
  text,
  cc,
  from,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  /** Versión en texto plano. Si falta, se saca del HTML: siempre se manda. */
  text?: string;
  cc?: string | string[];
  from?: string;
  replyTo?: string;
}): Promise<{ messageId: string | null }> {
  if (!env.SMTP_HOST) {
    console.log(`[Email] To: ${to} | Subject: ${subject} (SMTP not configured, skipping send)`);
    return { messageId: null };
  }
  const info = await transporter.sendMail({
    from: from ?? env.SMTP_FROM,
    to,
    cc,
    replyTo,
    subject,
    html,
    text: text ?? htmlToText(html),
  });
  return { messageId: (info.messageId as string | undefined) ?? null };
}

/** Manda un correo ya armado por `emails/`. */
export function sendRendered(
  to: string,
  email: RenderedEmail,
  extra: { cc?: string | string[]; from?: string; replyTo?: string } = {}
): Promise<{ messageId: string | null }> {
  return sendEmail({ to, subject: email.subject, html: email.html, text: email.text, ...extra });
}

function recipientParts(user: EmailRecipient): { name: string; lang: ReturnType<typeof toEmailLang> } {
  return { name: displayName(user.name, user.email), lang: toEmailLang(user.language) };
}

export async function sendWelcomeEmail(user: EmailRecipient & { organizationName?: string | null }): Promise<void> {
  const { name, lang } = recipientParts(user);
  await sendRendered(user.email, welcomeEmail({ name, organizationName: user.organizationName }, lang));
}

export async function sendVerificationEmail(user: EmailRecipient, token: string): Promise<void> {
  const { name, lang } = recipientParts(user);
  await sendRendered(user.email, verifyEmail({ name, token }, lang));
}

/** Aviso de que se vinculó un proveedor externo (Google) a la cuenta. */
export async function sendAccountLinkedEmail(user: EmailRecipient, providerLabel: string): Promise<void> {
  const { name, lang } = recipientParts(user);
  await sendRendered(user.email, accountLinkedEmail({ name, provider: providerLabel }, lang));
}

export async function sendPasswordResetEmail(user: EmailRecipient, token: string): Promise<void> {
  const { name, lang } = recipientParts(user);
  await sendRendered(user.email, passwordResetEmail({ name, token }, lang));
}

export async function sendInvitationEmail(invite: {
  inviterName: string | null | undefined;
  inviteeEmail: string;
  organizationName: string;
  token: string;
  /** Idioma guardado del invitado (`users.language`). */
  language?: string | null;
}): Promise<void> {
  await sendRendered(
    invite.inviteeEmail,
    invitationEmail(
      { inviterName: invite.inviterName, organizationName: invite.organizationName, token: invite.token },
      toEmailLang(invite.language)
    )
  );
}

export async function sendOrgAccessEmail(user: EmailRecipient, storeName: string, token: string): Promise<void> {
  await sendRendered(user.email, orgAccessEmail({ storeName, token }, toEmailLang(user.language)));
}
