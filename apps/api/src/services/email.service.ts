import crypto from 'crypto';
import { Resend } from 'resend';
import { Webhook } from 'svix';
import { env } from '../config/env';
import { query } from '../config/database';
import { escapeHtmlWithBreaks, sanitizeDisplayName, stripLineBreaks } from '../utils/html';
import { detectImageMime } from './image-sniff';
import {
  agentInboundAddress,
  buildReferences,
  extractNewMessage,
  htmlToText,
  normalizeMessageId,
  replySubject,
} from './email-parsing';

export { agentInboundAddress, detectAutomatedEmail, resolveAgentId, parseAddress } from './email-parsing';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;
const MAX_PDF_TEXT = 8000;
const MAX_BODY_TEXT = 20000;

let client: Resend | null = null;
function resend(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

export function isEmailChannelConfigured(): boolean {
  return !!env.RESEND_API_KEY && !!env.RESEND_WEBHOOK_SECRET;
}

// ── Webhook signature (Svix) ──────────────────────────────────────────────────

export interface ResendReceivedEvent {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    cc?: string[];
    received_for?: string[];
    message_id: string;
    subject: string;
  };
}

/** Verifies the Svix signature over the RAW body. Throws on a bad signature or a stale timestamp. */
export function verifyResendWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ResendReceivedEvent {
  if (!env.RESEND_WEBHOOK_SECRET) {
    throw new Error('RESEND_WEBHOOK_SECRET is not configured');
  }
  const pick = (name: string): string => {
    const value = headers[name];
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
  };
  const body = rawBody.toString('utf-8');
  // svix's verify() only validates (throws on failure) — it does not return the payload
  new Webhook(env.RESEND_WEBHOOK_SECRET).verify(body, {
    'svix-id': pick('svix-id'),
    'svix-timestamp': pick('svix-timestamp'),
    'svix-signature': pick('svix-signature'),
  });
  return JSON.parse(body) as ResendReceivedEvent;
}

// ── Receiving ─────────────────────────────────────────────────────────────────

export interface EmailAttachmentContent {
  kind: 'image' | 'pdf';
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface ReceivedAttachmentMeta {
  id: string;
  filename: string | null;
  content_type: string;
  content_disposition: string | null;
}

export interface ReceivedEmail {
  text: string;
  headers: Record<string, string>;
  attachmentMetas: ReceivedAttachmentMeta[];
}

export interface DownloadedAttachments {
  attachments: EmailAttachmentContent[];
  skipped: number;
}

async function downloadAttachment(url: string, maxBytes: number): Promise<Buffer> {
  if (!url.startsWith('https://')) throw new Error('Attachment URL must use https');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Attachment download failed: ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new Error('Attachment too large');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error('Attachment too large');
  return buffer;
}

/** The webhook only carries metadata: body and headers come from the Receiving API. Quoted history is stripped here. */
export async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const { data, error } = await resend().emails.receiving.get(emailId);
  if (error || !data) {
    throw new Error(`Resend receiving.get failed: ${error?.message ?? 'no data'}`);
  }
  const rawText = data.text?.trim() ? data.text : data.html ? htmlToText(data.html) : '';
  return {
    text: extractNewMessage(rawText).slice(0, MAX_BODY_TEXT),
    headers: data.headers ?? {},
    attachmentMetas: data.attachments ?? [],
  };
}

/**
 * Images are validated by magic bytes (the declared content type is not trusted); PDFs by the %PDF header.
 * At most MAX_ATTACHMENTS are read; anything else counts as skipped so the agent can say so.
 */
export async function downloadAttachments(emailId: string, metas: ReceivedAttachmentMeta[]): Promise<DownloadedAttachments> {
  const attachments: EmailAttachmentContent[] = [];
  let skipped = 0;
  // Inline non-image parts (signature logos are images; cid parts of other types) are noise
  const candidates = metas.filter((m) => m.content_disposition !== 'inline' || m.content_type.startsWith('image/'));
  for (const meta of candidates.slice(0, MAX_ATTACHMENTS)) {
    const isPdf = meta.content_type === 'application/pdf';
    const isImage = meta.content_type.startsWith('image/');
    if (!isPdf && !isImage) { skipped++; continue; }
    try {
      const detail = await resend().emails.receiving.attachments.get({ emailId, id: meta.id });
      if (detail.error || !detail.data) throw new Error(detail.error?.message ?? 'no attachment data');
      const buffer = await downloadAttachment(detail.data.download_url, isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE);
      const filename = stripLineBreaks(meta.filename ?? (isPdf ? 'document.pdf' : 'image'));
      if (isPdf) {
        if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Not a PDF');
        attachments.push({ kind: 'pdf', filename, mimeType: 'application/pdf', data: buffer });
      } else {
        const mime = detectImageMime(buffer);
        // The vision pipeline takes PNG/JPEG/WebP (GIF is not supported, same as the other channels)
        if (!mime || mime === 'image/gif') throw new Error('Unsupported image format');
        attachments.push({ kind: 'image', filename, mimeType: mime, data: buffer });
      }
    } catch (err) {
      skipped++;
      console.warn(`[email] Skipping attachment "${meta.filename ?? meta.id}":`, (err as Error).message);
    }
  }
  skipped += Math.max(0, candidates.length - MAX_ATTACHMENTS);
  return { attachments, skipped };
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text.trim().slice(0, MAX_PDF_TEXT);
}

// ── Sending ───────────────────────────────────────────────────────────────────

export interface EmailConfig {
  connected?: boolean;
  inbound_address?: string | null;
  reply_from_name?: string;
  signature_html?: string;
  auto_reply_enabled?: boolean;
  auto_reply_text?: string;
}

/** signature_html is only ever produced by escapeHtmlWithBreaks(plain text); this is its exact inverse. */
export function signatureToText(signatureHtml: string): string {
  return htmlToText(signatureHtml);
}

function bodyToHtml(text: string): string {
  return escapeHtmlWithBreaks(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export interface SendEmailReplyInput {
  agentId: string;
  agentName: string;
  config: EmailConfig;
  to: string;
  subject: string;
  text: string;
  inReplyTo: string | null;
  references: string[];
  includeSignature?: boolean;
}

/**
 * Sends through the Resend API (not SMTP) from agent-{id}@inbound-domain, with In-Reply-To/References so the
 * reply lands in the prospect's existing thread. Returns the Message-ID we assigned, to extend the chain.
 */
export async function sendEmailReply(input: SendEmailReplyInput): Promise<string> {
  const fromName = sanitizeDisplayName(input.config.reply_from_name || input.agentName) || 'GenSmart';
  const messageId = `<${crypto.randomUUID()}@${env.EMAIL_INBOUND_DOMAIN}>`;
  const signatureHtml = input.includeSignature === false ? '' : (input.config.signature_html ?? '').trim();

  const html =
    `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #1A1A1A;">${bodyToHtml(input.text)}` +
    (signatureHtml ? `<div style="margin-top: 16px;">${signatureHtml}</div>` : '') +
    '</div>';
  const text = input.text.replace(/\*\*(.+?)\*\*/g, '$1') + (signatureHtml ? `\n\n${signatureToText(signatureHtml)}` : '');

  const headers: Record<string, string> = { 'Message-ID': messageId };
  if (input.inReplyTo) {
    headers['In-Reply-To'] = input.inReplyTo;
    headers['References'] = input.references.join(' ');
  }

  const { error } = await resend().emails.send({
    from: `${fromName} <${agentInboundAddress(input.agentId, env.EMAIL_INBOUND_DOMAIN)}>`,
    to: input.to,
    subject: replySubject(input.subject),
    html,
    text,
    headers,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
  return messageId;
}

export interface EmailThreadMetadata {
  subject: string;
  from_address: string;
  last_message_id: string;
  references: string[];
}

export function readThread(channelMetadata: Record<string, unknown> | null | undefined): EmailThreadMetadata | null {
  const raw = channelMetadata?.['email'] as Partial<EmailThreadMetadata> | undefined;
  if (!raw?.from_address || !raw.last_message_id) return null;
  return {
    subject: raw.subject ?? '',
    from_address: raw.from_address,
    last_message_id: raw.last_message_id,
    references: Array.isArray(raw.references) ? raw.references : [],
  };
}

export async function saveThread(conversationId: string, thread: EmailThreadMetadata): Promise<void> {
  await query(
    `UPDATE conversations
     SET channel_metadata = COALESCE(channel_metadata, '{}'::jsonb) || jsonb_build_object('email', $2::jsonb)
     WHERE id = $1`,
    [conversationId, JSON.stringify(thread)]
  );
}

export function nextThread(
  previous: EmailThreadMetadata | null,
  incoming: { subject: string; fromAddress: string; messageId: string; referencesHeader: string | undefined }
): EmailThreadMetadata {
  return {
    subject: incoming.subject || previous?.subject || '',
    from_address: incoming.fromAddress,
    last_message_id: normalizeMessageId(incoming.messageId),
    references: buildReferences(previous?.references ?? [], incoming.referencesHeader, incoming.messageId),
  };
}

/**
 * Sends an agent (or human-takeover) message on an email conversation, continuing its thread.
 * Used by the message worker and by the takeover endpoint. Throws when the channel is not usable.
 */
export async function sendEmailToConversation(conversationId: string, agentId: string, text: string): Promise<void> {
  const result = await query<{ email_config: EmailConfig | null; agent_name: string; channel_metadata: Record<string, unknown> | null; contact_email: string | null }>(
    `SELECT a.email_config, a.name AS agent_name, c.channel_metadata, co.email AS contact_email
     FROM conversations c
     JOIN agents a ON a.id = c.agent_id
     LEFT JOIN contacts co ON co.id = c.contact_id
     WHERE c.id = $1 AND a.id = $2`,
    [conversationId, agentId]
  );
  const row = result.rows[0];
  if (!row?.email_config?.connected) {
    throw new Error('Email channel is not connected for this agent');
  }
  const thread = readThread(row.channel_metadata);
  const to = thread?.from_address ?? row.contact_email;
  if (!to) {
    throw new Error('No recipient address for this email conversation');
  }

  const messageId = await sendEmailReply({
    agentId,
    agentName: row.agent_name,
    config: row.email_config,
    to,
    subject: thread?.subject ?? '',
    text,
    inReplyTo: thread?.last_message_id ?? null,
    references: thread?.references ?? [],
  });

  if (thread) {
    await saveThread(conversationId, { ...thread, references: buildReferences(thread.references, undefined, messageId) });
  }
}

export function formatAttachmentNotice(filenames: string[], skipped: number): string {
  const parts: string[] = [];
  if (filenames.length > 0) parts.push(`[Attachments: ${filenames.join(', ')}]`);
  if (skipped > 0) parts.push(`[${skipped} attachment(s) could not be read or have an unsupported type]`);
  return parts.join('\n');
}
