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
 * Resolve the Page access token for an agent. Messenger has no platform-level fallback:
 * a Page token is the only credential that can send or receive for that Page.
 */
export function resolveAccessToken(fbConfig: Record<string, unknown> | null | undefined): string {
  const encrypted = fbConfig?.['page_access_token_encrypted'];
  if (!encrypted) {
    throw new Error('No Messenger Page access token stored for this agent');
  }
  return decryptPageAccessToken(String(encrypted));
}

const MAX_TEXT_LENGTH = 2000;

/** Splits on paragraph/line/space boundaries so each part fits Messenger's 2000-character limit. */
export function splitMessengerText(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > MAX_TEXT_LENGTH) {
    const window = rest.slice(0, MAX_TEXT_LENGTH);
    let cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf(' '));
    if (cut < MAX_TEXT_LENGTH / 2) cut = MAX_TEXT_LENGTH;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function sendTextMessage(pageAccessToken: string, recipientPsid: string, text: string): Promise<void> {
  for (const part of splitMessengerText(text)) {
    const response = await fetch(`${META_BASE_URL}/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        messaging_type: 'RESPONSE',
        recipient: { id: recipientPsid },
        message: { text: part },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Messenger API error: ${JSON.stringify(errorData)}`);
    }
  }
}

async function postMessage(pageAccessToken: string, recipientPsid: string, message: Record<string, unknown>, label: string): Promise<void> {
  const response = await fetch(`${META_BASE_URL}/me/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({ messaging_type: 'RESPONSE', recipient: { id: recipientPsid }, message }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Messenger ${label} error: ${JSON.stringify(errorData)}`);
  }
}

type AttachmentType = 'image' | 'video' | 'file';

// Messenger attachments carry no caption: the caption (if any) goes as a text message right after.
async function sendAttachment(
  pageAccessToken: string,
  recipientPsid: string,
  type: AttachmentType,
  url: string,
  caption?: string
): Promise<void> {
  if (!url.startsWith('https://')) {
    throw new Error('Media URL must use https');
  }
  await postMessage(
    pageAccessToken,
    recipientPsid,
    { attachment: { type, payload: { url, is_reusable: true } } },
    `send ${type}`
  );
  if (caption?.trim()) {
    await sendTextMessage(pageAccessToken, recipientPsid, caption);
  }
}

export function sendImageMessage(pageAccessToken: string, recipientPsid: string, imageUrl: string, caption?: string): Promise<void> {
  return sendAttachment(pageAccessToken, recipientPsid, 'image', imageUrl, caption);
}

export function sendVideoMessage(pageAccessToken: string, recipientPsid: string, videoUrl: string, caption?: string): Promise<void> {
  return sendAttachment(pageAccessToken, recipientPsid, 'video', videoUrl, caption);
}

export function sendDocumentMessage(pageAccessToken: string, recipientPsid: string, documentUrl: string, caption?: string): Promise<void> {
  return sendAttachment(pageAccessToken, recipientPsid, 'file', documentUrl, caption);
}

/**
 * Button Template with one web_url button — Messenger's equivalent of WhatsApp's cta_url.
 * Meta limits: text 640 chars, button title 20 chars, https URLs only.
 */
export async function sendButtonMessage(
  pageAccessToken: string,
  recipientPsid: string,
  text: string,
  buttonText: string,
  url: string
): Promise<void> {
  if (!url.startsWith('https://')) {
    throw new Error('Button URL must use https');
  }
  await postMessage(
    pageAccessToken,
    recipientPsid,
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
  recipientPsid: string,
  action: 'mark_seen' | 'typing_on'
): Promise<void> {
  await fetch(`${META_BASE_URL}/me/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({ recipient: { id: recipientPsid }, sender_action: action }),
  }).catch(() => {
    // Non-critical
  });
}

/**
 * Messenger attachments arrive as direct CDN URLs (no media-ID round trip, no token needed).
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
  // Messenger voice clips are served as audio/* (mp4/aac/mpeg); some CDNs label them video/mp4
  if (!mimeType.startsWith('audio/') && mimeType !== 'video/mp4') {
    throw new Error(`Expected audio media type, got: ${mimeType}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error(`Downloaded audio too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 25MB.`);
  }
  return { buffer, mimeType: mimeType === 'video/mp4' ? 'audio/mp4' : mimeType };
}

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

const MAX_PAGE_LOOKUPS = 5;

/** Pages the user administers (GET /me/accounts), following pagination up to a small cap. */
export async function listUserPages(userAccessToken: string): Promise<FacebookPage[]> {
  const pages: FacebookPage[] = [];
  let url: string | null = `${META_BASE_URL}/me/accounts?fields=id,name,access_token&limit=100`;

  for (let i = 0; i < MAX_PAGE_LOOKUPS && url; i++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${userAccessToken}` } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to list Facebook Pages: ${JSON.stringify(err)}`);
    }
    const body = await res.json() as {
      data?: Array<{ id?: string; name?: string; access_token?: string }>;
      paging?: { next?: string };
    };
    for (const p of body.data ?? []) {
      if (p.id && p.access_token) {
        pages.push({ id: String(p.id), name: p.name ?? String(p.id), accessToken: p.access_token });
      }
    }
    url = body.paging?.next ?? null;
  }
  return pages;
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
    `${META_BASE_URL}/${encodeURIComponent(pageId)}/subscribed_apps?subscribed_fields=messages,messaging_postbacks`,
    { method: 'POST', headers: { Authorization: `Bearer ${pageAccessToken}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[messenger] Page subscribe failed:', JSON.stringify(err));
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
