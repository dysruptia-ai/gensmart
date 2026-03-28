import { query } from '../config/database';
import { encrypt, decrypt } from '../config/encryption';
import { redis } from '../config/redis';

const CACHE_PREFIX = 'platform_setting:';
const CACHE_TTL = 300; // 5 minutes

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  is_encrypted: boolean;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * Get a platform setting value by key.
 * Uses Redis cache (5-min TTL). Decrypts automatically if encrypted.
 */
export async function getSettingValue(key: string): Promise<string> {
  const cacheKey = `${CACHE_PREFIX}${key}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Query DB
  const result = await query<PlatformSetting>(
    'SELECT value, is_encrypted FROM platform_settings WHERE key = $1',
    [key]
  );

  if (result.rows.length === 0) {
    throw new Error(`Platform setting not found: ${key}`);
  }

  const row = result.rows[0]!;
  let value = row.value;

  if (row.is_encrypted && value) {
    try {
      value = decrypt(value);
    } catch {
      throw new Error(`Failed to decrypt platform setting: ${key}`);
    }
  }

  // Cache decrypted value
  if (value) {
    await redis.set(cacheKey, value, 'EX', CACHE_TTL);
  }

  return value;
}

/**
 * Set a platform setting value.
 * Encrypts automatically if the setting is marked as encrypted.
 * Invalidates Redis cache.
 */
export async function setSettingValue(
  key: string,
  value: string,
  updatedBy: string
): Promise<void> {
  // Check if this key is encrypted
  const existing = await query<{ is_encrypted: boolean }>(
    'SELECT is_encrypted FROM platform_settings WHERE key = $1',
    [key]
  );

  if (existing.rows.length === 0) {
    throw new Error(`Platform setting not found: ${key}`);
  }

  const storedValue = existing.rows[0]!.is_encrypted ? encrypt(value) : value;

  await query(
    `UPDATE platform_settings
     SET value = $1, updated_by = $2, updated_at = NOW()
     WHERE key = $3`,
    [storedValue, updatedBy, key]
  );

  // Invalidate cache
  await redis.del(`${CACHE_PREFIX}${key}`);
}

/**
 * Get all platform settings. Masks encrypted values for display.
 */
export async function getAllSettings(): Promise<Array<{
  key: string;
  value: string;
  is_encrypted: boolean;
  description: string | null;
  updated_at: string;
}>> {
  const result = await query<PlatformSetting>(
    'SELECT key, value, is_encrypted, description, updated_at FROM platform_settings ORDER BY key'
  );

  return result.rows.map((row) => ({
    key: row.key,
    value: row.is_encrypted && row.value ? '••••••••' : row.value,
    is_encrypted: row.is_encrypted,
    description: row.description,
    updated_at: row.updated_at,
  }));
}

/**
 * Get a single setting (masked for display).
 */
export async function getSetting(key: string): Promise<{
  key: string;
  value: string;
  is_encrypted: boolean;
  description: string | null;
  updated_at: string;
} | null> {
  const result = await query<PlatformSetting>(
    'SELECT key, value, is_encrypted, description, updated_at FROM platform_settings WHERE key = $1',
    [key]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0]!;
  return {
    key: row.key,
    value: row.is_encrypted && row.value ? '••••••••' : row.value,
    is_encrypted: row.is_encrypted,
    description: row.description,
    updated_at: row.updated_at,
  };
}

/**
 * Convenience: get the WhatsApp System User token (decrypted).
 */
export async function getWhatsAppToken(): Promise<string> {
  return getSettingValue('whatsapp_system_user_token');
}

/**
 * Test if a WhatsApp token is valid by calling Meta's debug_token API.
 */
export async function testWhatsAppToken(token: string): Promise<{
  valid: boolean;
  appId?: string;
  expiresAt?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${token}`
    );
    const data = await response.json() as {
      data?: {
        is_valid?: boolean;
        app_id?: string;
        expires_at?: number;
        error?: { message?: string };
      };
    };

    if (data.data?.is_valid) {
      return {
        valid: true,
        appId: data.data.app_id,
        expiresAt: data.data.expires_at
          ? new Date(data.data.expires_at * 1000).toISOString()
          : 'never',
      };
    }

    return {
      valid: false,
      error: data.data?.error?.message || 'Token is not valid',
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to verify token: ${(err as Error).message}`,
    };
  }
}

/**
 * Invalidate all cached platform settings.
 */
export async function invalidateAllCache(): Promise<void> {
  const keys = await redis.keys(`${CACHE_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
