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

export function encryptAccessToken(token: string): string {
  return encrypt(token);
}

export function decryptAccessToken(encryptedToken: string): string {
  return decrypt(encryptedToken);
}

export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string
): Promise<string> {
  // Opción A: pass redirect_uri as empty string — Meta treats omission differently from ''
  const url = `${META_BASE_URL}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=&code=${code}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to exchange code for token: ${JSON.stringify(error)}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}
