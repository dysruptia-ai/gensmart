"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettingValue = getSettingValue;
exports.setSettingValue = setSettingValue;
exports.getAllSettings = getAllSettings;
exports.inferCategory = inferCategory;
exports.getAllSettingsWithMeta = getAllSettingsWithMeta;
exports.getSetting = getSetting;
exports.getWhatsAppToken = getWhatsAppToken;
exports.testWhatsAppToken = testWhatsAppToken;
exports.invalidateAllCache = invalidateAllCache;
const database_1 = require("../config/database");
const encryption_1 = require("../config/encryption");
const redis_1 = require("../config/redis");
const CACHE_PREFIX = 'platform_setting:';
const CACHE_TTL = 300; // 5 minutes
/**
 * Get a platform setting value by key.
 * Uses Redis cache (5-min TTL). Decrypts automatically if encrypted.
 */
async function getSettingValue(key) {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    // Try cache first
    const cached = await redis_1.redis.get(cacheKey);
    if (cached !== null) {
        return cached;
    }
    // Query DB
    const result = await (0, database_1.query)('SELECT value, is_encrypted FROM platform_settings WHERE key = $1', [key]);
    if (result.rows.length === 0) {
        throw new Error(`Platform setting not found: ${key}`);
    }
    const row = result.rows[0];
    let value = row.value;
    if (row.is_encrypted && value) {
        try {
            value = (0, encryption_1.decrypt)(value);
        }
        catch {
            throw new Error(`Failed to decrypt platform setting: ${key}`);
        }
    }
    // Cache decrypted value
    if (value) {
        await redis_1.redis.set(cacheKey, value, 'EX', CACHE_TTL);
    }
    return value;
}
/**
 * Set a platform setting value.
 * Encrypts automatically if the setting is marked as encrypted.
 * Invalidates Redis cache.
 */
async function setSettingValue(key, value, updatedBy) {
    // Check if this key is encrypted
    const existing = await (0, database_1.query)('SELECT is_encrypted FROM platform_settings WHERE key = $1', [key]);
    if (existing.rows.length === 0) {
        throw new Error(`Platform setting not found: ${key}`);
    }
    const storedValue = existing.rows[0].is_encrypted ? (0, encryption_1.encrypt)(value) : value;
    await (0, database_1.query)(`UPDATE platform_settings
     SET value = $1, updated_by = $2, updated_at = NOW()
     WHERE key = $3`, [storedValue, updatedBy, key]);
    // Invalidate cache
    await redis_1.redis.del(`${CACHE_PREFIX}${key}`);
}
/**
 * Get all platform settings. Masks encrypted values for display.
 */
async function getAllSettings() {
    const result = await (0, database_1.query)('SELECT key, value, is_encrypted, description, updated_at FROM platform_settings ORDER BY key');
    return result.rows.map((row) => ({
        key: row.key,
        value: row.is_encrypted && row.value ? '••••••••' : row.value,
        is_encrypted: row.is_encrypted,
        description: row.description,
        updated_at: row.updated_at,
    }));
}
/**
 * Infer the UI grouping category from the setting key prefix.
 */
function inferCategory(key) {
    if (key.startsWith('whatsapp_') || key === 'meta_app_id' || key === 'meta_config_id') {
        return 'whatsapp';
    }
    if (key.startsWith('mastershop_'))
        return 'mastershop';
    if (key.startsWith('dropi_'))
        return 'dropi';
    if (key.startsWith('zendrop_'))
        return 'zendrop';
    if (key.startsWith('synchroteam_'))
        return 'synchroteam';
    return 'other';
}
/**
 * Get all platform settings with safe metadata for the admin UI.
 * Encrypted values are NEVER returned in plain text — only `has_value` flag.
 */
async function getAllSettingsWithMeta() {
    const result = await (0, database_1.query)('SELECT key, value, is_encrypted, description, updated_at FROM platform_settings ORDER BY key');
    return result.rows.map((row) => {
        const hasValue = row.value !== null && row.value !== '';
        return {
            key: row.key,
            description: row.description,
            is_encrypted: row.is_encrypted,
            has_value: hasValue,
            value: row.is_encrypted ? null : row.value,
            category: inferCategory(row.key),
            updated_at: row.updated_at,
        };
    });
}
/**
 * Get a single setting (masked for display).
 */
async function getSetting(key) {
    const result = await (0, database_1.query)('SELECT key, value, is_encrypted, description, updated_at FROM platform_settings WHERE key = $1', [key]);
    if (result.rows.length === 0)
        return null;
    const row = result.rows[0];
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
async function getWhatsAppToken() {
    return getSettingValue('whatsapp_system_user_token');
}
/**
 * Test if a WhatsApp token is valid by calling Meta's debug_token API.
 */
async function testWhatsAppToken(token) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${token}`);
        const data = await response.json();
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
    }
    catch (err) {
        return {
            valid: false,
            error: `Failed to verify token: ${err.message}`,
        };
    }
}
/**
 * Invalidate all cached platform settings.
 */
async function invalidateAllCache() {
    const keys = await redis_1.redis.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
        await redis_1.redis.del(...keys);
    }
}
//# sourceMappingURL=platform-settings.service.js.map