/**
 * Public docs feedback (POST /api/docs-feedback): "Was this guide helpful?" on each
 * knowledge base guide. Pure logic with an injected email sender, so validation and the
 * honeypot can be tested without SMTP or Redis.
 * Nothing is stored: no IP, no personal data. One summary email per submission.
 */
import { z } from 'zod';
import { DOC_FEEDBACK_COMMENT_MAX, DOC_FEEDBACK_REASONS, DOC_IDS } from '@gensmart/shared';
import { escapeHtml } from '../utils/html';
import { CONTACT_RECIPIENT, HONEYPOT_FIELD } from './contact-sales.service';

export const DOCS_FEEDBACK_RECIPIENT = CONTACT_RECIPIENT;

export const docsFeedbackSchema = z
  .object({
    page: z.enum(DOC_IDS),
    language: z.enum(['es', 'en']),
    helpful: z.boolean(),
    reason: z.enum(DOC_FEEDBACK_REASONS).optional(),
    comment: z.string().trim().max(DOC_FEEDBACK_COMMENT_MAX).optional(),
    [HONEYPOT_FIELD]: z.string().max(500).optional(),
  })
  .strict()
  // "No" requires a reason; "Yes" carries neither reason nor comment
  .refine((d) => (d.helpful ? d.reason === undefined && !d.comment : d.reason !== undefined));

export type DocsFeedbackInput = z.infer<typeof docsFeedbackSchema>;

export interface DocsFeedbackDeps {
  sendEmail: (mail: { to: string; subject: string; html: string }) => Promise<unknown>;
  wrapHtml: (content: string) => string;
}

export type DocsFeedbackResult =
  | { status: 200; body: { success: true } }
  | { status: 400; body: { error: { message: string; code: 'VALIDATION_ERROR' } } };

function row(label: string, value: string): string {
  return `<tr><td style="padding: 8px 0; color: #6B7280; width: 100px;">${label}</td><td style="padding: 8px 0; color: #1A1A1A;">${value}</td></tr>`;
}

export function buildDocsFeedbackEmail(data: DocsFeedbackInput): { subject: string; content: string } {
  const verdict = data.helpful ? 'Helpful' : 'Not helpful';
  const content = `
    <h2 style="color: #1A1A1A; font-size: 18px; margin: 0 0 16px;">Docs feedback: ${verdict}</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      ${row('Guide', escapeHtml(data.page))}
      ${row('Language', escapeHtml(data.language))}
      ${row('Helpful', data.helpful ? 'Yes' : 'No')}
      ${data.reason ? row('Reason', escapeHtml(data.reason)) : ''}
    </table>
    ${
      data.comment
        ? `<div style="margin-top: 16px; padding: 16px; background: #F5F0EB; border-radius: 8px;">
      <p style="color: #6B7280; font-size: 12px; margin: 0 0 4px;">Comment</p>
      <p style="color: #1A1A1A; font-size: 14px; margin: 0; white-space: pre-wrap;">${escapeHtml(data.comment)}</p>
    </div>`
        : ''
    }
  `;
  return { subject: `GenSmart docs feedback: ${data.page} (${verdict})`, content };
}

export async function handleDocsFeedback(body: unknown, deps: DocsFeedbackDeps): Promise<DocsFeedbackResult> {
  // Honeypot first: a bot gets a normal-looking success and nothing is sent
  if (body && typeof body === 'object') {
    const trap = (body as Record<string, unknown>)[HONEYPOT_FIELD];
    if (typeof trap === 'string' && trap.trim() !== '') return { status: 200, body: { success: true } };
  }
  const parsed = docsFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: { message: 'Invalid feedback', code: 'VALIDATION_ERROR' } } };
  }
  const { subject, content } = buildDocsFeedbackEmail(parsed.data);
  // A failed send throws: the route answers 500 and the page shows an error, not "Thanks"
  await deps.sendEmail({ to: DOCS_FEEDBACK_RECIPIENT, subject, html: deps.wrapHtml(content) });
  return { status: 200, body: { success: true } };
}
