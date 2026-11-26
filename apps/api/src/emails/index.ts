/** Correos de la plataforma: cada uno recibe datos tipados y el idioma, y devuelve `{ subject, html, text }`. */
export { welcomeEmail, type WelcomeEmailData } from './templates/welcome';
export { verifyEmail, type VerifyEmailData } from './templates/verify-email';
export { passwordResetEmail, type PasswordResetEmailData } from './templates/password-reset';
export { accountLinkedEmail, type AccountLinkedEmailData } from './templates/account-linked';
export { invitationEmail, type InvitationEmailData } from './templates/invitation';
export { orgAccessEmail, type OrgAccessEmailData } from './templates/org-access';
export { highScoreLeadEmail, type HighScoreLeadEmailData } from './templates/high-score-lead';
export { planLimitEmail, type PlanLimitEmailData } from './templates/plan-limit';
export { orgSuspendedEmail, type OrgSuspendedEmailData, type SuspensionReason } from './templates/org-suspended';
export { appointmentNewEmail, type AppointmentNewEmailData } from './templates/appointment-new';
export { appointmentConfirmedEmail, type AppointmentConfirmedEmailData } from './templates/appointment-confirmed';
export {
  agentNotificationEmail,
  agentNotificationTestEmail,
  type AgentNotificationEmailData,
  type AgentNotificationTestEmailData,
} from './templates/agent-notification';
export { wrapInternalHtml, htmlToText } from './layout';
export { getWebUrl, webUrl, APP_PATHS, WELCOME_VIDEO } from './links';
export { buildFromAddress, parseFromAddress } from './from-address';
export { toEmailLang, type EmailLang, type EmailRecipient, type RenderedEmail } from './types';
