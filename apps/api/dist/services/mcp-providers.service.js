"use strict";
/**
 * MCP Provider Profiles Service
 *
 * A "provider profile" is a pre-configured template for a known MCP server
 * (Mastershop, Dropi, Zendrop, ...). It lets GenSmart:
 *   1. Auto-inject platform-level credentials (master keys, fixed webhook URLs)
 *      so customers never see them.
 *   2. Render a guided UI with only the headers the customer must fill
 *      (typically 1: their own API key for the dropshipping platform).
 *   3. Detect the provider automatically when the customer pastes a known URL.
 *
 * The MCP client (mcp-client.service.ts) is unchanged — profile resolution
 * happens BEFORE invoking the client. The `extraHeaders` arg stays agnostic.
 *
 * value_ref resolution (auto_injected_headers):
 *   "platform_setting:foo" → await getSettingValue('foo'); empty → empty string + warn.
 *   "fixed:literal_string" → literal.
 *   unknown prefix          → log error, header omitted.
 *
 * Caching:
 *   - listActiveProfiles() cached 5 min in Redis (key `mcp:providers:active`).
 *   - findProfileById() cached 5 min in Redis (key `mcp:provider:<id>`).
 *   - findProfileByUrl() iterates listActiveProfiles in-memory (no extra round-trip;
 *     called frequently from the frontend debounced URL detection).
 *   - Cache invalidation: any create/update/delete clears the affected keys
 *     plus the active list.
 *
 * To add a new provider: prefer the Admin UI at /admin/mcp-providers
 * (CRUD-backed). For provider profiles that ship with the platform, add a
 * SQL seed in a new migration similar to 038.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listActiveProfiles = listActiveProfiles;
exports.listAllProfiles = listAllProfiles;
exports.findProfileById = findProfileById;
exports.findProfileByUrl = findProfileByUrl;
exports.resolveAutoHeaders = resolveAutoHeaders;
exports.createProfile = createProfile;
exports.updateProfile = updateProfile;
exports.deleteProfile = deleteProfile;
exports.invalidateCache = invalidateCache;
exports.toPublicProfile = toPublicProfile;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const platform_settings_service_1 = require("./platform-settings.service");
const CACHE_TTL_SECONDS = 300;
const PROFILES_ACTIVE_CACHE_KEY = 'mcp:providers:active';
const PROFILE_CACHE_PREFIX = 'mcp:provider:';
function parseHealthCheckTool(field) {
    if (field == null)
        return null;
    if (typeof field === 'object') {
        const obj = field;
        if (typeof obj.name === 'string' && obj.name.length > 0) {
            return { name: obj.name, params: obj.params ?? {} };
        }
        return null;
    }
    try {
        const parsed = JSON.parse(field);
        if (parsed && typeof parsed.name === 'string' && parsed.name.length > 0) {
            return { name: parsed.name, params: parsed.params ?? {} };
        }
        return null;
    }
    catch {
        return null;
    }
}
function parseJsonField(field, fallback) {
    if (field == null)
        return fallback;
    if (Array.isArray(field))
        return field;
    try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : fallback;
    }
    catch {
        return fallback;
    }
}
function rowToProfile(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        logo_url: row.logo_url ?? undefined,
        match_url_pattern: row.match_url_pattern,
        match_strategy: row.match_strategy,
        default_transport: row.default_transport,
        default_server_url: row.default_server_url ?? undefined,
        auto_injected_headers: parseJsonField(row.auto_injected_headers, []),
        user_configurable_headers: parseJsonField(row.user_configurable_headers, []),
        supported_events: parseJsonField(row.supported_events, []),
        health_check_tool: parseHealthCheckTool(row.health_check_tool),
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
/**
 * List all active provider profiles. Cached in Redis (5 min).
 */
async function listActiveProfiles() {
    const cached = await redis_1.redis.get(PROFILES_ACTIVE_CACHE_KEY).catch(() => null);
    if (cached) {
        try {
            return JSON.parse(cached);
        }
        catch {
            // fall through to DB
        }
    }
    const result = await database_1.pool.query(`SELECT * FROM mcp_provider_profiles WHERE is_active = true ORDER BY name`);
    const profiles = result.rows.map(rowToProfile);
    await redis_1.redis.setex(PROFILES_ACTIVE_CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(profiles)).catch(() => { });
    return profiles;
}
/**
 * List ALL profiles (active + inactive). Used by admin UI; no cache.
 */
async function listAllProfiles() {
    const result = await database_1.pool.query(`SELECT * FROM mcp_provider_profiles ORDER BY name`);
    return result.rows.map(rowToProfile);
}
/**
 * Find a single profile by id. Cached in Redis (5 min).
 * Returns inactive profiles too — callers must check is_active when relevant.
 */
async function findProfileById(id) {
    if (!id)
        return null;
    const cacheKey = `${PROFILE_CACHE_PREFIX}${id}`;
    const cached = await redis_1.redis.get(cacheKey).catch(() => null);
    if (cached) {
        try {
            return JSON.parse(cached);
        }
        catch {
            // fall through to DB
        }
    }
    const result = await database_1.pool.query(`SELECT * FROM mcp_provider_profiles WHERE id = $1`, [id]);
    if (result.rows.length === 0)
        return null;
    const profile = rowToProfile(result.rows[0]);
    await redis_1.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(profile)).catch(() => { });
    return profile;
}
/**
 * Find the first active profile that matches the given URL. Iterates over the
 * cached active list in-memory (no extra DB query per call). Returns null if
 * the URL is malformed or no profile matches.
 */
async function findProfileByUrl(url) {
    if (!url || typeof url !== 'string')
        return null;
    let parsed = null;
    try {
        parsed = new URL(url);
    }
    catch {
        parsed = null;
    }
    const hostname = parsed ? parsed.hostname.toLowerCase() : '';
    const profiles = await listActiveProfiles();
    for (const profile of profiles) {
        const pattern = profile.match_url_pattern;
        if (!pattern)
            continue;
        switch (profile.match_strategy) {
            case 'domain_contains': {
                if (hostname && hostname.includes(pattern.toLowerCase()))
                    return profile;
                break;
            }
            case 'domain_exact': {
                if (hostname && hostname === pattern.toLowerCase())
                    return profile;
                break;
            }
            case 'url_prefix': {
                if (url.startsWith(pattern))
                    return profile;
                break;
            }
            case 'regex': {
                try {
                    const re = new RegExp(pattern);
                    if (re.test(url))
                        return profile;
                }
                catch (err) {
                    console.error(`[mcp-providers] Invalid regex for profile ${profile.id}: ${err.message}`);
                }
                break;
            }
        }
    }
    return null;
}
/**
 * Resolve auto-injected headers for a profile by reading platform settings
 * and substituting `value_ref` references. Empty platform settings yield an
 * empty-string header value (with a warning log) — the request still goes out
 * but the upstream MCP will probably reject it. Unknown `value_ref` prefixes
 * are dropped.
 */
async function resolveAutoHeaders(profile) {
    const out = {};
    for (const h of profile.auto_injected_headers) {
        if (!h?.key || !h?.value_ref)
            continue;
        const ref = h.value_ref;
        const colonIdx = ref.indexOf(':');
        if (colonIdx === -1) {
            console.error(`[mcp-providers] Header "${h.key}" in profile ${profile.id} has malformed value_ref: ${ref}`);
            continue;
        }
        const prefix = ref.slice(0, colonIdx);
        const rest = ref.slice(colonIdx + 1);
        if (prefix === 'platform_setting') {
            try {
                const value = await (0, platform_settings_service_1.getSettingValue)(rest);
                if (!value) {
                    console.warn(`[mcp-providers] Platform setting "${rest}" is empty (profile ${profile.id}, header ${h.key})`);
                    out[h.key] = '';
                }
                else {
                    out[h.key] = value;
                }
            }
            catch (err) {
                console.error(`[mcp-providers] Failed to read platform setting "${rest}":`, err.message);
                out[h.key] = '';
            }
        }
        else if (prefix === 'fixed') {
            out[h.key] = rest;
        }
        else {
            console.error(`[mcp-providers] Unknown value_ref prefix "${prefix}" for header "${h.key}" in profile ${profile.id}`);
        }
    }
    return out;
}
async function createProfile(data) {
    const result = await database_1.pool.query(`INSERT INTO mcp_provider_profiles
      (id, name, description, logo_url, match_url_pattern, match_strategy,
       default_transport, default_server_url, auto_injected_headers,
       user_configurable_headers, supported_events, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12)
     RETURNING *`, [
        data.id,
        data.name,
        data.description ?? null,
        data.logo_url ?? null,
        data.match_url_pattern,
        data.match_strategy,
        data.default_transport,
        data.default_server_url ?? null,
        JSON.stringify(data.auto_injected_headers),
        JSON.stringify(data.user_configurable_headers),
        JSON.stringify(data.supported_events),
        data.is_active,
    ]);
    await invalidateCache(data.id);
    return rowToProfile(result.rows[0]);
}
async function updateProfile(id, data) {
    const fields = [];
    const values = [];
    let idx = 1;
    if (data.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(data.name);
    }
    if (data.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(data.description);
    }
    if (data.logo_url !== undefined) {
        fields.push(`logo_url = $${idx++}`);
        values.push(data.logo_url);
    }
    if (data.match_url_pattern !== undefined) {
        fields.push(`match_url_pattern = $${idx++}`);
        values.push(data.match_url_pattern);
    }
    if (data.match_strategy !== undefined) {
        fields.push(`match_strategy = $${idx++}`);
        values.push(data.match_strategy);
    }
    if (data.default_transport !== undefined) {
        fields.push(`default_transport = $${idx++}`);
        values.push(data.default_transport);
    }
    if (data.default_server_url !== undefined) {
        fields.push(`default_server_url = $${idx++}`);
        values.push(data.default_server_url);
    }
    if (data.auto_injected_headers !== undefined) {
        fields.push(`auto_injected_headers = $${idx++}::jsonb`);
        values.push(JSON.stringify(data.auto_injected_headers));
    }
    if (data.user_configurable_headers !== undefined) {
        fields.push(`user_configurable_headers = $${idx++}::jsonb`);
        values.push(JSON.stringify(data.user_configurable_headers));
    }
    if (data.supported_events !== undefined) {
        fields.push(`supported_events = $${idx++}::jsonb`);
        values.push(JSON.stringify(data.supported_events));
    }
    if (data.is_active !== undefined) {
        fields.push(`is_active = $${idx++}`);
        values.push(data.is_active);
    }
    if (fields.length === 0) {
        return findProfileById(id);
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await database_1.pool.query(`UPDATE mcp_provider_profiles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    if (result.rows.length === 0)
        return null;
    await invalidateCache(id);
    return rowToProfile(result.rows[0]);
}
/**
 * Soft-delete a profile (sets is_active = false). Existing tools that
 * reference it keep their `providerId` but `findProfileById` callers should
 * skip when `!profile.is_active`.
 */
async function deleteProfile(id) {
    const result = await database_1.pool.query(`UPDATE mcp_provider_profiles SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    await invalidateCache(id);
    return (result.rowCount ?? 0) > 0;
}
/**
 * Invalidate the active-list cache and (optionally) a single profile's cache.
 * Pass `id` for targeted invalidation; omit to clear active list only (single
 * profile keys expire naturally on TTL).
 */
async function invalidateCache(id) {
    const keys = [PROFILES_ACTIVE_CACHE_KEY];
    if (id)
        keys.push(`${PROFILE_CACHE_PREFIX}${id}`);
    if (keys.length > 0) {
        await redis_1.redis.del(...keys).catch(() => { });
    }
}
/**
 * Strip sensitive fields (auto_injected_headers, match_url_pattern,
 * match_strategy) before exposing to non-admin callers / frontend.
 */
function toPublicProfile(profile) {
    return {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        logo_url: profile.logo_url,
        default_server_url: profile.default_server_url,
        default_transport: profile.default_transport,
        user_configurable_headers: profile.user_configurable_headers,
        supported_events: profile.supported_events,
    };
}
//# sourceMappingURL=mcp-providers.service.js.map