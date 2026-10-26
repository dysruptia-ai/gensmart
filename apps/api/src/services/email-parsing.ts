import EmailReplyParser from 'email-reply-parser';

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
