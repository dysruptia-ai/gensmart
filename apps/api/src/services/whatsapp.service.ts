import crypto from 'crypto';
import { encrypt, decrypt } from '../config/encryption';

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<void> {
  // Meta Cloud API requires phone numbers in format: +1234567890
  const normalizedTo = to.startsWith('+') ? to : `+${to}`;

  const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
  }
}

export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).catch(() => {
    // Non-critical — mark as read failures don't affect message delivery
  });
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  const signatureValue = signature.replace('sha256=', '');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signatureValue, 'hex')
    );
  } catch {
    return false;
  }
}

export async function getPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string
): Promise<{ display_phone_number: string; verified_name: string }> {
  const url = `${META_BASE_URL}/${phoneNumberId}?fields=display_phone_number,verified_name`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get phone number info: ${response.status}`);
  }

  return response.json() as Promise<{ display_phone_number: string; verified_name: string }>;
}

export async function getWABAAndPhoneNumber(accessToken: string): Promise<{
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
}> {
  // Step 1: get WABA accounts linked to this user token
  const wabaRes = await fetch(
    `${META_BASE_URL}/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!wabaRes.ok) {
    const err = await wabaRes.json().catch(() => ({}));
    throw new Error(`Failed to fetch WABA accounts: ${JSON.stringify(err)}`);
  }

  const wabaData = await wabaRes.json() as {
    data?: Array<{
      id: string;
      phone_numbers?: { data?: Array<{ id: string; display_phone_number: string }> };
    }>;
  };

  const waba = wabaData.data?.[0];
  if (!waba) throw new Error('No WhatsApp Business Account found for this user');

  const phoneEntry = waba.phone_numbers?.data?.[0];
  if (!phoneEntry) {
    // Fallback: list phone numbers directly from WABA
    const pnRes = await fetch(
      `${META_BASE_URL}/${waba.id}/phone_numbers?fields=id,display_phone_number`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (pnRes.ok) {
      const pnData = await pnRes.json() as { data?: Array<{ id: string; display_phone_number: string }> };
      const pn = pnData.data?.[0];
      if (pn) {
        return { wabaId: waba.id, phoneNumberId: pn.id, displayPhone: pn.display_phone_number };
      }
    }
    throw new Error('No phone number found in WhatsApp Business Account');
  }

  return {
    wabaId: waba.id,
    phoneNumberId: phoneEntry.id,
    displayPhone: phoneEntry.display_phone_number,
  };
}

/**
 * Download media from WhatsApp via Meta Media API.
 * Step 1: GET media URL from media ID
 * Step 2: GET binary content from the temporary URL
 */
export async function downloadMedia(
  mediaId: string,
  accessToken: string
): Promise<{ data: string; mimeType: string }> {
  // Step 1: Get the media URL
  const metaUrl = `${META_BASE_URL}/${mediaId}`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(`Failed to get media URL: ${JSON.stringify(err)}`);
  }

  const metaData = await metaRes.json() as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };

  if (!metaData.url) {
    throw new Error('No URL returned for media');
  }

  const mimeType = metaData.mime_type ?? 'image/jpeg';

  // Only allow image types
  if (!mimeType.startsWith('image/')) {
    throw new Error(`Unsupported media type: ${mimeType}. Only images are supported.`);
  }

  // Reject files > 5MB
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  if (metaData.file_size && metaData.file_size > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large (${Math.round(metaData.file_size / 1024 / 1024)}MB). Max 5MB.`);
  }

  // Step 2: Download the binary data from the temporary URL
  const dataRes = await fetch(metaData.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!dataRes.ok) {
    throw new Error(`Failed to download media: ${dataRes.status}`);
  }

  const arrayBuffer = await dataRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Downloaded image too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 5MB.`);
  }

  const data = buffer.toString('base64');

  return { data, mimeType };
}

/**
 * Download audio from WhatsApp via Meta Media API.
 * Same 2-step process as downloadMedia, but for audio files.
 */
export async function downloadAudio(
  mediaId: string,
  accessToken: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaUrl = `${META_BASE_URL}/${mediaId}`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(`Failed to get audio media URL: ${JSON.stringify(err)}`);
  }

  const metaData = await metaRes.json() as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };

  if (!metaData.url) {
    throw new Error('No URL returned for audio media');
  }

  const mimeType = metaData.mime_type ?? 'audio/ogg';

  if (!mimeType.startsWith('audio/')) {
    throw new Error(`Expected audio media type, got: ${mimeType}`);
  }

  // Whisper API limit: 25MB
  const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
  if (metaData.file_size && metaData.file_size > MAX_AUDIO_SIZE) {
    throw new Error(`Audio too large (${Math.round(metaData.file_size / 1024 / 1024)}MB). Max 25MB.`);
  }

  const dataRes = await fetch(metaData.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!dataRes.ok) {
    throw new Error(`Failed to download audio: ${dataRes.status}`);
  }

  const arrayBuffer = await dataRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error(`Downloaded audio too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 25MB.`);
  }

  return { buffer, mimeType };
}

/**
 * Transcribe audio using OpenAI Whisper API.
 * Accepts audio buffer directly. Auto-detects language.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  // Map mimeType to file extension for Whisper
  const extMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/ogg; codecs=opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/mp4; codecs=opus': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
    'audio/webm; codecs=opus': 'webm',
    'audio/flac': 'flac',
  };

  const baseMime = mimeType.split(';')[0]!.trim();
  const ext = extMap[mimeType] ?? extMap[baseMime] ?? 'ogg';

  // OpenAI SDK v4+ accepts File objects
  const file = new File([audioBuffer], `audio.${ext}`, { type: baseMime });

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });

  return response.text;
}

/**
 * Resolve the WhatsApp access token for an agent.
 * Priority: agent's stored token > platform system user token.
 */
export async function resolveAccessToken(
  waConfig: Record<string, unknown> | null | undefined
): Promise<string> {
  // 1. Try agent-level token
  if (waConfig?.access_token_encrypted) {
    try {
      return decryptAccessToken(String(waConfig.access_token_encrypted));
    } catch {
      console.warn('[whatsapp] Failed to decrypt agent token, falling back to platform token');
    }
  }

  // 2. Fallback to platform-level token
  const { getWhatsAppToken } = await import('./platform-settings.service');
  const platformToken = await getWhatsAppToken();
  if (!platformToken) {
    throw new Error('No WhatsApp access token available (agent or platform)');
  }
  return platformToken;
}

export function encryptAccessToken(token: string): string {
  return encrypt(token);
}

export function decryptAccessToken(encryptedToken: string): string {
  return decrypt(encryptedToken);
}
