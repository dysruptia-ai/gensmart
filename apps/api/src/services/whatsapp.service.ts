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
  const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
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

export function encryptAccessToken(token: string): string {
  return encrypt(token);
}

export function decryptAccessToken(encryptedToken: string): string {
  return decrypt(encryptedToken);
}

export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri?: string
): Promise<string> {
  let url = `${META_BASE_URL}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`;
  if (redirectUri) {
    url += `&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to exchange code for token: ${JSON.stringify(error)}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}
