/**
 * Get a platform setting value by key.
 * Uses Redis cache (5-min TTL). Decrypts automatically if encrypted.
 */
export declare function getSettingValue(key: string): Promise<string>;
/**
 * Set a platform setting value.
 * Encrypts automatically if the setting is marked as encrypted.
 * Invalidates Redis cache.
 */
export declare function setSettingValue(key: string, value: string, updatedBy: string): Promise<void>;
/**
 * Get all platform settings. Masks encrypted values for display.
 */
export declare function getAllSettings(): Promise<Array<{
    key: string;
    value: string;
    is_encrypted: boolean;
    description: string | null;
    updated_at: string;
}>>;
export type SettingCategory = 'whatsapp' | 'mastershop' | 'dropi' | 'zendrop' | 'synchroteam' | 'other';
export interface PlatformSettingMeta {
    key: string;
    description: string | null;
    is_encrypted: boolean;
    has_value: boolean;
    value: string | null;
    category: SettingCategory;
    updated_at: string;
}
/**
 * Infer the UI grouping category from the setting key prefix.
 */
export declare function inferCategory(key: string): SettingCategory;
/**
 * Get all platform settings with safe metadata for the admin UI.
 * Encrypted values are NEVER returned in plain text — only `has_value` flag.
 */
export declare function getAllSettingsWithMeta(): Promise<PlatformSettingMeta[]>;
/**
 * Get a single setting (masked for display).
 */
export declare function getSetting(key: string): Promise<{
    key: string;
    value: string;
    is_encrypted: boolean;
    description: string | null;
    updated_at: string;
} | null>;
/**
 * Convenience: get the WhatsApp System User token (decrypted).
 */
export declare function getWhatsAppToken(): Promise<string>;
/**
 * Test if a WhatsApp token is valid by calling Meta's debug_token API.
 */
export declare function testWhatsAppToken(token: string): Promise<{
    valid: boolean;
    appId?: string;
    expiresAt?: string;
    error?: string;
}>;
/**
 * Invalidate all cached platform settings.
 */
export declare function invalidateAllCache(): Promise<void>;
//# sourceMappingURL=platform-settings.service.d.ts.map