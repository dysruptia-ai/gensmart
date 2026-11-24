/**
 * Public contact form (POST /api/contact-sales): the "Talk to sales" dialog and the /contacto page.
 * Pure logic with injected side effects, so validation, honeypot and Turnstile rules can be tested
 * without SMTP, Redis or network.
 */
import { z } from 'zod';
import { escapeHtml, stripLineBreaks } from '../utils/html';

export const CONTACT_TYPES = ['demo', 'sales', 'partner', 'directorio', 'recomendacion', 'comunidad'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

/** Honeypot field: hidden from people, bots tend to fill it. */
export const HONEYPOT_FIELD = 'website';

/** Fixed recipient: unchanged from the original endpoint. */
export const CONTACT_RECIPIENT = 'dysruptia1000@gmail.com';

export const contactSalesSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(300),
  company: z.string().max(200).optional().default(''),
  message: z.string().trim().min(1).max(5000),
  whatsapp: z
    .string()
    .trim()
    .max(40)
    .regex(/^[0-9+\-() ]*$/)
    .optional()
    .default(''),
  // Default `sales` keeps the original "Talk to sales" dialog behaviour
  type: z.enum(CONTACT_TYPES).optional().default('sales'),
  language: z.enum(['es', 'en']).optional(),
  turnstileToken: z.string().max(2048).optional(),
  [HONEYPOT_FIELD]: z.string().max(500).optional(),
});

export type ContactSalesInput = z.infer<typeof contactSalesSchema>;

export const CONTACT_SUBJECTS: Record<ContactType, string> = {
  demo: 'Demo request',
  sales: 'Enterprise inquiry',
  partner: 'Partner: agency path',
  directorio: 'Partner: directory listing',
  recomendacion: 'Partner recommendation request',
  comunidad: 'Community waitlist',
};

export interface ContactSalesDeps {
  /** True when the server has TURNSTILE_SECRET_KEY: the token is then mandatory. */
  turnstileConfigured: boolean;
  verifyTurnstile: (token: string, ip?: string) => Promise<boolean>;
  sendEmail: (mail: { to: string; subject: string; html: string }) => Promise<unknown>;
  /** Wraps the body in the shared email layout. */
  wrapHtml: (content: string) => string;
}

export type ContactSalesResult =
  | { status: 200; body: { success: true } }
  | { status: 400; body: { error: { message: string; code: 'VALIDATION_ERROR' | 'CAPTCHA_FAILED' } } };

function row(label: string, value: string): string {
  return `<tr><td style="padding: 8px 0; color: #6B7280; width: 100px;">${label}</td><td style="padding: 8px 0; color: #1A1A1A;">${value}</td></tr>`;
}

export function buildContactEmail(data: ContactSalesInput): { subject: string; content: string } {
  const title = CONTACT_SUBJECTS[data.type];
  const content = `
    <h2 style="color: #1A1A1A; font-size: 18px; margin: 0 0 16px;">${escapeHtml(title)}</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      ${row('Name', `<strong>${escapeHtml(data.name)}</strong>`)}
      ${row('Email', `<a href="mailto:${escapeHtml(data.email)}" style="color: #25D366;">${escapeHtml(data.email)}</a>`)}
      ${data.company ? row('Company', escapeHtml(data.company)) : ''}
      ${data.whatsapp ? row('WhatsApp', escapeHtml(data.whatsapp)) : ''}
      ${row('Type', escapeHtml(data.type))}
      ${data.language ? row('Language', escapeHtml(data.language)) : ''}
    </table>
    <div style="margin-top: 16px; padding: 16px; background: #F5F0EB; border-radius: 8px;">
      <p style="color: #6B7280; font-size: 12px; margin: 0 0 4px;">Message</p>
      <p style="color: #1A1A1A; font-size: 14px; margin: 0; white-space: pre-wrap;">${escapeHtml(data.message)}</p>
    </div>
  `;
  return { subject: `GenSmart ${title} from ${stripLineBreaks(data.name)}`, content };
}

export async function handleContactSales(
  body: unknown,
  ip: string | undefined,
  deps: ContactSalesDeps
): Promise<ContactSalesResult> {
  // Honeypot first: a bot gets a normal-looking success and nothing is sent
  if (body && typeof body === 'object') {
    const trap = (body as Record<string, unknown>)[HONEYPOT_FIELD];
    if (typeof trap === 'string' && trap.trim() !== '') return { status: 200, body: { success: true } };
  }

  const parsed = contactSalesSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: { message: 'Invalid form data', code: 'VALIDATION_ERROR' } } };
  }
  const data = parsed.data;

  if (deps.turnstileConfigured) {
    const ok = data.turnstileToken ? await deps.verifyTurnstile(data.turnstileToken, ip) : false;
    if (!ok) {
      return {
        status: 400,
        body: { error: { message: 'Captcha verification failed. Please try again.', code: 'CAPTCHA_FAILED' } },
      };
    }
  }

  const { subject, content } = buildContactEmail(data);
  await deps.sendEmail({ to: CONTACT_RECIPIENT, subject, html: deps.wrapHtml(content) });
  return { status: 200, body: { success: true } };
}
