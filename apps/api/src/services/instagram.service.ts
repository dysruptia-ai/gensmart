import { encrypt, decrypt } from '../config/encryption';

const META_API_VERSION = 'v22.0';
export const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

export function encryptPageAccessToken(token: string): string {
  return encrypt(token);
}

export function decryptPageAccessToken(encryptedToken: string): string {
  return decrypt(encryptedToken);
}

/**
 * Resolve the Page access token for an agent. Instagram messaging uses the PAGE token of the Page the
 * professional account is linked to; there is no platform-level fallback.
 */
export function resolveAccessToken(igConfig: Record<string, unknown> | null | undefined): string {
  const encrypted = igConfig?.['page_access_token_encrypted'];
  if (!encrypted) {
    throw new Error('No Instagram Page access token stored for this agent');
  }
  return decryptPageAccessToken(String(encrypted));
}

/** Instagram professional account ID — the node every send endpoint is addressed to. */
export function resolveInstagramId(igConfig: Record<string, unknown> | null | undefined): string {
  const id = igConfig?.['instagram_id'];
  if (!id) {
    throw new Error('No Instagram account ID stored for this agent');
  }
  return String(id);
}

/** Thrown when Meta reports the account owner has not enabled "Allow access to messages" (Connected tools). */
export class InstagramMessagingDisabledError extends Error {
  constructor() {
    super('The Instagram account owner has disabled third-party access to messages');
    this.name = 'InstagramMessagingDisabledError';
  }
}

// Substring match on the lower-cased error body: Meta varies the wording slightly
function isMessagingDisabledError(errorBody: unknown): boolean {
  const msg = JSON.stringify(errorBody).toLowerCase();
  return msg.includes('disabled access to instagram direct messages')
    || msg.includes('disabled third-party access');
}

function messagesUrl(instagramAccountId: string): string {
  return `${META_BASE_URL}/${encodeURIComponent(instagramAccountId)}/messages`;
}

// Instagram limits a text message to 1000 bytes (UTF-8), not characters.
const MAX_TEXT_BYTES = 1000;

/** Splits on paragraph/line/space boundaries so each part fits Instagram's 1000-byte limit. */
export function splitInstagramText(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (Buffer.byteLength(rest, 'utf8') > MAX_TEXT_BYTES) {
    let end = Math.min(rest.length, MAX_TEXT_BYTES);
    while (Buffer.byteLength(rest.slice(0, end), 'utf8') > MAX_TEXT_BYTES) end--;
    const window = rest.slice(0, end);
    let cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf(' '));
    if (cut < end / 2) {
      cut = end;
      // Never split a surrogate pair (emoji)
      const prev = rest.charCodeAt(cut - 1);
      if (prev >= 0xd800 && prev <= 0xdbff) cut--;
    }
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function postMessage(
  pageAccessToken: string,
  instagramAccountId: string,
  recipientId: string,
  message: Record<string, unknown>,
  label: string
): Promise<void> {
  const response = await fetch(messagesUrl(instagramAccountId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({ messaging_type: 'RESPONSE', recipient: { id: recipientId }, message }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (isMessagingDisabledError(errorData)) throw new InstagramMessagingDisabledError();
    throw new Error(`Instagram ${label} error: ${JSON.stringify(errorData)}`);
  }
}

export async function sendTextMessage(
  pageAccessToken: string,
  instagramAccountId: string,
  recipientId: string,
  text: string
): Promise<void> {
  for (const part of splitInstagramText(text)) {
    await postMessage(pageAccessToken, instagramAccountId, recipientId, { text: part }, 'send text');
  }
}

type AttachmentType = 'image' | 'video' | 'file';

// Attachments carry no caption: the caption (if any) goes as a text message right after.
async function sendAttachment(
  pageAccessToken: string,
  instagramAccountId: string,
  recipientId: string,
  type: AttachmentType,
  url: string,
  caption?: string
): Promise<void> {
  if (!url.startsWith('https://')) {
    throw new Error('Media URL must use https');
  }
  await postMessage(
    pageAccessToken,
    instagramAccountId,
    recipientId,
    { attachment: { type, payload: { url } } },
    `send ${type}`
  );
  if (caption?.trim()) {
    await sendTextMessage(pageAccessToken, instagramAccountId, recipientId, caption);
  }
}

export function sendImageMessage(
  pageAccessToken: string,
  instagramAccountId: string,
  recipientId: string,
  imageUrl: string,
  caption?: string
): Promise<void> {
  return sendAttachment(pageAccessToken, instagramAccountId, recipientId, 'image', imageUrl, caption);
}

export function sendVideoMessage(
  pageAccessToken: string,
  instagramAccountId: string,
  recipientId: string,
  videoUrl: string,
  caption?: string
): Promise<void> {
  return sendAttachment(pageAccessToken, instagramAccountId, recipientId, 'video', videoUrl, caption);
}

export function sendDocumentMessage(
  pageAccessToken: string,
  instagramAccountId: string,
  recipientId: string,
  documentUrl: string,
  caption?: string
): Promise<void> {
  return sendAttachment(pageAccessToken, instagramAccountId, recipientId, 'file', documentUrl, caption);
}

/**
 * Button Template with one web_url button.
 * Meta limits: text 640 chars, button title 20 chars, https URLs only.
 */
export async function sendButtonMessage(
  pageAccessToken: string,
  instagramAccountId: string,
  recipientId: string,
  text: string,
  buttonText: string,
  url: string
): Promise<void> {
  if (!url.startsWith('https://')) {
    throw new Error('Button URL must use https');
  }
  await postMessage(
    pageAccessToken,
    instagramAccountId,
    recipientId,
    {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text.slice(0, 640),
          buttons: [{ type: 'web_url', url, title: buttonText.slice(0, 20) }],
        },
      },
    },
    'send button'
  );
}

/** Fire-and-forget sender action (mark_seen / typing_on). Failures never affect delivery. */
export async function sendSenderAction(
  pageAccessToken: string,
  instagramAccountId: string,
  recipientId: string,
  action: 'mark_seen' | 'typing_on'
): Promise<void> {
  await fetch(messagesUrl(instagramAccountId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({ recipient: { id: recipientId }, sender_action: action }),
  }).catch(() => {
    // Non-critical
  });
}

/**
 * Instagram attachments arrive as direct CDN URLs (no media-ID round trip, no token needed).
 */
export async function downloadImageFromUrl(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);

  const mimeType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0]!.trim();
  if (!mimeType.startsWith('image/')) {
    throw new Error(`Unsupported media type: ${mimeType}. Only images are supported.`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Downloaded image too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 5MB.`);
  }
  return { data: buffer.toString('base64'), mimeType };
}

export async function downloadAudioFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`);

  const mimeType = (res.headers.get('content-type') ?? 'audio/mpeg').split(';')[0]!.trim();
  // Voice clips are served as audio/* (mp4/aac/mpeg); some CDNs label them video/mp4
  if (!mimeType.startsWith('audio/') && mimeType !== 'video/mp4') {
    throw new Error(`Expected audio media type, got: ${mimeType}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error(`Downloaded audio too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 25MB.`);
  }
  return { buffer, mimeType: mimeType === 'video/mp4' ? 'audio/mp4' : mimeType };
}

export interface InstagramAccount {
  instagramId: string;
  username: string;
  pageId: string;
  pageName: string;
  accessToken: string; // the Page access token — the one used to send/receive
}

const MAX_PAGE_LOOKUPS = 5;

/** Instagram professional accounts linked to Pages the user administers (GET /me/accounts), capped pagination. */
export async function listInstagramAccounts(userAccessToken: string): Promise<InstagramAccount[]> {
  const accounts: InstagramAccount[] = [];
  let url: string | null =
    `${META_BASE_URL}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100`;

  for (let i = 0; i < MAX_PAGE_LOOKUPS && url; i++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${userAccessToken}` } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (isMessagingDisabledError(err)) throw new InstagramMessagingDisabledError();
      throw new Error(`Failed to list Instagram accounts: ${JSON.stringify(err)}`);
    }
    const body = await res.json() as {
      data?: Array<{
        id?: string;
        name?: string;
        access_token?: string;
        instagram_business_account?: { id?: string; username?: string };
      }>;
      paging?: { next?: string };
    };
    for (const p of body.data ?? []) {
      const ig = p.instagram_business_account;
      if (p.id && p.access_token && ig?.id) {
        accounts.push({
          instagramId: String(ig.id),
          username: ig.username ?? String(ig.id),
          pageId: String(p.id),
          pageName: p.name ?? String(p.id),
          accessToken: p.access_token,
        });
      }
    }
    url = body.paging?.next ?? null;
  }
  return accounts;
}

/**
 * Exchange a (short-lived) user token for a long-lived one so the Page tokens derived from it
 * do not expire. Best effort: returns the original token if the exchange fails.
 */
export async function exchangeForLongLivedToken(
  userAccessToken: string,
  appId: string,
  appSecret: string
): Promise<string> {
  try {
    const res = await fetch(
      `${META_BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(userAccessToken)}`
    );
    if (!res.ok) return userAccessToken;
    const body = await res.json() as { access_token?: string };
    return body.access_token || userAccessToken;
  } catch {
    return userAccessToken;
  }
}

export async function subscribePageToApp(pageId: string, pageAccessToken: string): Promise<boolean> {
  const res = await fetch(
    `${META_BASE_URL}/${encodeURIComponent(pageId)}/subscribed_apps?subscribed_fields=messages`,
    { method: 'POST', headers: { Authorization: `Bearer ${pageAccessToken}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (isMessagingDisabledError(err)) throw new InstagramMessagingDisabledError();
    console.error('[instagram] Page subscribe failed:', JSON.stringify(err));
    return false;
  }
  return true;
}

export async function unsubscribePageFromApp(pageId: string, pageAccessToken: string): Promise<void> {
  await fetch(`${META_BASE_URL}/${encodeURIComponent(pageId)}/subscribed_apps`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${pageAccessToken}` },
  }).catch(() => {
    // Best effort — the local config is cleared regardless
  });
}
