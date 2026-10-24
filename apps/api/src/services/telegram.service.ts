import { encrypt, decrypt } from '../config/encryption';

const TELEGRAM_API = 'https://api.telegram.org';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const MAX_TEXT_LENGTH = 4096;

// <digits>:<35+ chars of A-Za-z0-9_-> — the shape @BotFather issues
export const BOT_TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;

export function encryptBotToken(token: string): string {
  return encrypt(token);
}

export function decryptBotToken(encryptedToken: string): string {
  return decrypt(encryptedToken);
}

/** Resolve the bot token for an agent. Telegram has no platform-level fallback: each agent owns its bot. */
export function resolveBotToken(tgConfig: Record<string, unknown> | null | undefined): string {
  const encrypted = tgConfig?.['bot_token_encrypted'];
  if (!encrypted) {
    throw new Error('No Telegram bot token stored for this agent');
  }
  return decryptBotToken(String(encrypted));
}

/** Value shown to the frontend instead of the real token: only the last 4 characters survive. */
export function maskBotToken(token: string): string {
  return `•••••${token.slice(-4)}`;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

// The bot token travels in the URL path: errors are built from Telegram's `description` only,
// never from the URL, so the token cannot leak into logs.
async function callBotApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => ({})) as TelegramResponse<T>;
  if (!response.ok || !data.ok || data.result === undefined) {
    throw new TelegramApiError(method, data.error_code ?? response.status, data.description ?? 'Unknown error');
  }
  return data.result;
}

export class TelegramApiError extends Error {
  constructor(
    public readonly method: string,
    public readonly errorCode: number,
    public readonly description: string
  ) {
    super(`Telegram ${method} error ${errorCode}: ${description}`);
    this.name = 'TelegramApiError';
  }
}

export interface TelegramBotInfo {
  id: string;
  username: string;
  firstName: string;
}

/** Confirms the token is valid (getMe) and returns the bot's public identity. */
export async function validateBotToken(token: string): Promise<TelegramBotInfo> {
  const me = await callBotApi<{ id: number; username?: string; first_name?: string; is_bot?: boolean }>(token, 'getMe');
  if (!me.is_bot || !me.username) {
    throw new TelegramApiError('getMe', 0, 'Token does not belong to a bot with a username');
  }
  return { id: String(me.id), username: me.username, firstName: me.first_name ?? me.username };
}

/**
 * Registers the webhook. Telegram echoes `secretToken` in the X-Telegram-Bot-Api-Secret-Token header of every
 * update — the only authentication Telegram offers (payloads are not signed).
 */
export async function setTelegramWebhook(token: string, webhookUrl: string, secretToken: string): Promise<void> {
  await callBotApi<boolean>(token, 'setWebhook', {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
}

export async function deleteTelegramWebhook(token: string): Promise<void> {
  await callBotApi<boolean>(token, 'deleteWebhook', { drop_pending_updates: true });
}

/** Splits on paragraph/line/space boundaries so each part fits Telegram's 4096-character limit. */
export function splitTelegramText(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > MAX_TEXT_LENGTH) {
    const window = rest.slice(0, MAX_TEXT_LENGTH);
    let cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf(' '));
    if (cut < MAX_TEXT_LENGTH / 2) {
      cut = MAX_TEXT_LENGTH;
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

// Plain text on purpose: the LLM's Markdown would otherwise need escaping to survive Telegram's parse modes.
export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  for (const part of splitTelegramText(text)) {
    await callBotApi(token, 'sendMessage', { chat_id: chatId, text: part });
  }
}

// Telegram captions are limited to 1024 characters; the overflow goes as a text message.
async function sendWithCaption(
  token: string,
  method: 'sendPhoto' | 'sendVideo' | 'sendDocument',
  field: 'photo' | 'video' | 'document',
  chatId: string,
  url: string,
  caption?: string
): Promise<void> {
  if (!url.startsWith('https://')) {
    throw new Error('Media URL must use https');
  }
  const trimmed = caption?.trim();
  const fits = !!trimmed && trimmed.length <= 1024;
  await callBotApi(token, method, { chat_id: chatId, [field]: url, ...(fits ? { caption: trimmed } : {}) });
  if (trimmed && !fits) {
    await sendTelegramMessage(token, chatId, trimmed);
  }
}

export function sendTelegramPhoto(token: string, chatId: string, photoUrl: string, caption?: string): Promise<void> {
  return sendWithCaption(token, 'sendPhoto', 'photo', chatId, photoUrl, caption);
}

export function sendTelegramVideo(token: string, chatId: string, videoUrl: string, caption?: string): Promise<void> {
  return sendWithCaption(token, 'sendVideo', 'video', chatId, videoUrl, caption);
}

export function sendTelegramDocument(token: string, chatId: string, documentUrl: string, caption?: string): Promise<void> {
  return sendWithCaption(token, 'sendDocument', 'document', chatId, documentUrl, caption);
}

/**
 * Voice note by URL. Telegram only renders sendVoice as a native voice note for OGG/OPUS (also MP3/M4A per the
 * docs, but OGG/OPUS is the reliable case); any other format goes through sendAudio so it still plays.
 * Nothing in GenSmart generates outbound audio today (WhatsApp has no outbound voice either), so this is
 * not wired to the worker yet.
 */
export async function sendTelegramVoice(token: string, chatId: string, audioUrl: string): Promise<void> {
  if (!audioUrl.startsWith('https://')) {
    throw new Error('Audio URL must use https');
  }
  const path = audioUrl.split('?')[0]!.toLowerCase();
  const isOggOpus = path.endsWith('.ogg') || path.endsWith('.oga') || path.endsWith('.opus');
  if (isOggOpus) {
    await callBotApi(token, 'sendVoice', { chat_id: chatId, voice: audioUrl });
  } else {
    await callBotApi(token, 'sendAudio', { chat_id: chatId, audio: audioUrl });
  }
}

/** Fire-and-forget typing indicator. Failures never affect delivery. */
export async function sendTelegramTyping(token: string, chatId: string): Promise<void> {
  await callBotApi(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {
    // Non-critical
  });
}

/** Telegram webhooks carry only a file_id: getFile gives the file_path, then the file is fetched from /file/bot<token>/. */
export async function getTelegramFileUrl(token: string, fileId: string): Promise<string> {
  const file = await callBotApi<{ file_path?: string }>(token, 'getFile', { file_id: fileId });
  if (!file.file_path) {
    throw new Error('Telegram getFile returned no file_path (file may exceed the 20MB bot limit)');
  }
  return `${TELEGRAM_API}/file/bot${token}/${file.file_path}`;
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function downloadTelegramImage(token: string, fileId: string): Promise<{ data: string; mimeType: string }> {
  const url = await getTelegramFileUrl(token, fileId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download Telegram image: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Downloaded image too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 5MB.`);
  }
  // The file CDN serves application/octet-stream; photos are JPEG unless the path says otherwise
  const ext = url.split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
  return { data: buffer.toString('base64'), mimeType: IMAGE_MIME_BY_EXT[ext] ?? 'image/jpeg' };
}

export async function downloadTelegramAudio(token: string, fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const url = await getTelegramFileUrl(token, fileId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download Telegram audio: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error(`Downloaded audio too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 25MB.`);
  }
  // Voice notes are always OGG/OPUS
  return { buffer, mimeType: 'audio/ogg' };
}

// ── Incoming updates ──────────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    from?: { id?: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
    chat?: { id?: number; type?: string };
    text?: string;
    caption?: string;
    photo?: Array<{ file_id?: string; file_size?: number }>;
    voice?: { file_id?: string };
  };
}

export interface TelegramIncomingMessage {
  chatId: string;
  contactName: string | null;
  text: string;
  photoFileId: string | null;
  voiceFileId: string | null;
}

/**
 * Normalises a Telegram Update into what the webhook pipeline needs. Returns null for anything the agent
 * should not answer: non-message updates, groups/channels, other bots, and message types without text,
 * photo or voice (stickers, documents, locations...).
 */
export function parseIncomingUpdate(update: unknown): TelegramIncomingMessage | null {
  const message = (update as TelegramUpdate | null)?.message;
  if (!message || message.chat?.type !== 'private' || message.chat.id === undefined) return null;
  if (!message.from || message.from.is_bot) return null;

  // Photos arrive as several sizes of the same picture, smallest first
  const photoFileId = message.photo && message.photo.length > 0
    ? message.photo[message.photo.length - 1]?.file_id ?? null
    : null;
  const voiceFileId = message.voice?.file_id ?? null;
  const text = message.text ?? message.caption ?? '';
  if (!text && !photoFileId && !voiceFileId) return null;

  const name = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ').trim();
  return {
    chatId: String(message.chat.id),
    contactName: name || message.from.username || null,
    text,
    photoFileId,
    voiceFileId,
  };
}
