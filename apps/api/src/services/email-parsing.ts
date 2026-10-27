import EmailReplyParser from 'email-reply-parser';
import { NAME_FIELD_PATTERNS, EMAIL_FIELD_PATTERNS, PHONE_FIELD_PATTERNS } from './contact-field-patterns';

/**
 * Pure helpers for the email channel (no env, DB or network) so they can be tested on their own.
 */

const AGENT_LOCAL_PART = /^agent-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const MAX_REFERENCES = 20;

export interface ParsedAddress {
  name: string | null;
  address: string;
}

/** "Jane Doe <Jane@Example.com>" or "jane@example.com" → { name, address (lower-cased) }. Null when no address. */
export function parseAddress(raw: string): ParsedAddress | null {
  const angle = /^\s*"?([^"<]*?)"?\s*<([^<>\s]+@[^<>\s]+)>\s*$/.exec(raw);
  const address = (angle?.[2] ?? raw.trim()).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) return null;
  const name = angle?.[1]?.trim() ?? '';
  return { name: name || null, address };
}

/** Finds the agent id in the first recipient of the form agent-{uuid}@{domain}. */
export function resolveAgentId(recipients: string[], inboundDomain: string): string | null {
  for (const recipient of recipients) {
    const parsed = parseAddress(recipient);
    if (!parsed) continue;
    const [local, domain] = parsed.address.split('@');
    if (domain !== inboundDomain.toLowerCase()) continue;
    const match = AGENT_LOCAL_PART.exec(local ?? '');
    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}

export function agentInboundAddress(agentId: string, inboundDomain: string): string {
  return `agent-${agentId.toLowerCase()}@${inboundDomain.toLowerCase()}`;
}

function lowerHeaders(headers: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    out[key.toLowerCase()] = String(value);
  }
  return out;
}

const NON_HUMAN_LOCAL_PARTS = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce[sd]?|notifications?)([+._-].*)?$/i;

/**
 * Returns the reason an inbound email must NOT get an agent reply, or null when it looks human.
 * Mandatory loop protection: an out-of-office or a bounce answered by the agent would be answered again,
 * forever. Covers RFC 3834 Auto-Submitted, the legacy X-Autoreply family, bulk/list mail and DSN bounces.
 */
export function detectAutomatedEmail(
  headers: Record<string, string> | null | undefined,
  fromAddress: string
): string | null {
  const h = lowerHeaders(headers);

  const autoSubmitted = h['auto-submitted']?.trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') return `Auto-Submitted: ${autoSubmitted}`;
  if ('x-autoreply' in h) return 'X-Autoreply';
  if ('x-autorespond' in h) return 'X-Autorespond';
  // Exchange / Outlook out-of-office marker
  if (/\b(oof|autoreply|all)\b/i.test(h['x-auto-response-suppress'] ?? '')) return 'X-Auto-Response-Suppress';

  const precedence = h['precedence']?.trim().toLowerCase();
  if (precedence && ['bulk', 'junk', 'list', 'auto_reply', 'auto-reply'].includes(precedence)) {
    return `Precedence: ${precedence}`;
  }
  if ('list-id' in h || 'list-unsubscribe' in h) return 'mailing list';
  if (/multipart\/report/i.test(h['content-type'] ?? '')) return 'delivery status report';
  if (h['return-path']?.trim() === '<>') return 'null return-path (bounce)';

  const local = fromAddress.split('@')[0] ?? '';
  if (NON_HUMAN_LOCAL_PARTS.test(local)) return `non-human sender (${local})`;
  return null;
}

/** HTML → readable plain text, for senders whose client only produced an HTML part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Only what the sender just wrote: quoted history ("> ...", "On … wrote:", "El … escribió:", Outlook
 * "From:/Sent:" blocks) is dropped by email-reply-parser. Empty when the email holds only quoted history.
 */
export function extractNewMessage(text: string): string {
  return new EmailReplyParser().parseReply(text.replace(/\r\n?/g, '\n')).trim();
}

/** `<id@host>` form; Resend payloads may or may not include the angle brackets. */
export function normalizeMessageId(id: string): string {
  const bare = id.trim().replace(/^<|>$/g, '');
  return bare ? `<${bare}>` : '';
}

/** In-Reply-To / References chain: previous references + the message being answered, deduplicated, newest last. */
export function buildReferences(existing: string[], referencesHeader: string | undefined, messageId: string): string[] {
  const fromHeader = (referencesHeader ?? '').split(/\s+/).map(normalizeMessageId).filter(Boolean);
  const merged = [...existing, ...fromHeader, normalizeMessageId(messageId)].filter(Boolean);
  const unique = merged.filter((id, index) => merged.indexOf(id) === index);
  return unique.slice(-MAX_REFERENCES);
}

export function replySubject(subject: string): string {
  const clean = subject.replace(/[\r\n]+/g, ' ').trim() || '(no subject)';
  return /^(re|rv|aw|sv):/i.test(clean) ? clean : `Re: ${clean}`;
}

// ── Web-form notifications ────────────────────────────────────────────────────

export type FormFieldSeparator = 'colon' | 'equals' | 'both';

const MIN_FORM_FIELDS = 3;
const FORM_LINE_RATIO = 0.6; // at least 60% of the non-empty lines must match the "Field: Value" shape
const MAX_FORM_FIELDS = 20;
const MAX_FIELD_VALUE_LENGTH = 500;

function formFieldLinePattern(separator: FormFieldSeparator): RegExp {
  const sep = separator === 'colon' ? ':' : separator === 'equals' ? '=' : '[:=]';
  return new RegExp(`^([A-Za-zÀ-ÿ0-9 _'/-]{2,40})${sep}\\s*(.+)$`);
}

function nonEmptyLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * Generic heuristic for website form notifications (Contact Form 7, WPForms, Gravity Forms, Elementor... all
 * default to the same plain-text "Field: Value" repeated). The separator is per agent
 * (email_config.form_field_separator) because some sites use "=".
 */
export function detectFormSubmission(text: string, separator: FormFieldSeparator = 'colon'): boolean {
  const pattern = formFieldLinePattern(separator);
  const lines = nonEmptyLines(text);
  if (lines.length === 0) return false;
  const matches = lines.filter((l) => pattern.test(l)).length;
  return matches >= MIN_FORM_FIELDS && matches / lines.length >= FORM_LINE_RATIO;
}

/** Field→value pairs of a body already detected as a form. Keeps the first occurrence; values are truncated. */
export function extractFormFields(text: string, separator: FormFieldSeparator = 'colon'): Record<string, string> {
  const pattern = formFieldLinePattern(separator);
  const fields: Record<string, string> = {};
  for (const line of nonEmptyLines(text)) {
    if (Object.keys(fields).length >= MAX_FORM_FIELDS) break;
    const match = pattern.exec(line);
    if (!match) continue;
    const label = match[1]!.trim();
    if (label in fields) continue;
    fields[label] = match[2]!.trim().slice(0, MAX_FIELD_VALUE_LENGTH);
  }
  return fields;
}

export interface ClassifiedFormFields {
  name: string | null;
  email: string | null; // validated with parseAddress
  phone: string | null;
  custom: Record<string, string>; // everything else, for contacts.custom_variables
}

/** "Correo electrónico" → "correo_electronico": the shape the shared field-pattern lists use. */
function normalizeFieldLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function classifyFormFields(fields: Record<string, string>): ClassifiedFormFields {
  const result: ClassifiedFormFields = { name: null, email: null, phone: null, custom: {} };
  for (const [label, value] of Object.entries(fields)) {
    const key = normalizeFieldLabel(label);
    const address = EMAIL_FIELD_PATTERNS.includes(key) ? parseAddress(value) : null;
    if (!result.email && address) {
      result.email = address.address;
    } else if (!result.name && NAME_FIELD_PATTERNS.includes(key)) {
      result.name = value;
    } else if (!result.phone && PHONE_FIELD_PATTERNS.includes(key)) {
      result.phone = value;
    } else {
      result.custom[label] = value;
    }
  }
  return result;
}
