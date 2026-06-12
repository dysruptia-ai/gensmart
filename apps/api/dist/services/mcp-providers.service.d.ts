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
export interface UserConfigurableHeader {
    key: string;
    label_en: string;
    label_es: string;
    help_url?: string;
    help_text_en?: string;
    help_text_es?: string;
    required: boolean;
    min_length?: number;
}
export interface AutoInjectedHeader {
    key: string;
    value_ref: string;
    description?: string;
}
export type MatchStrategy = 'domain_contains' | 'domain_exact' | 'url_prefix' | 'regex';
export type MCPTransport = 'sse' | 'streamable-http';
/**
 * Optional health-check tool call used by the Test Connection endpoint to
 * validate that the customer's credentials are actually accepted by the
 * provider (handshake alone does not). NULL → handshake-only validation.
 */
export interface HealthCheckTool {
    name: string;
    params: Record<string, unknown>;
}
export interface MCPProviderProfile {
    id: string;
    name: string;
    description?: string;
    logo_url?: string;
    match_url_pattern: string;
    match_strategy: MatchStrategy;
    default_transport: MCPTransport;
    default_server_url?: string;
    auto_injected_headers: AutoInjectedHeader[];
    user_configurable_headers: UserConfigurableHeader[];
    supported_events: string[];
    /** Optional E2E auth health-check. See migration 039. */
    health_check_tool: HealthCheckTool | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}
/**
 * List all active provider profiles. Cached in Redis (5 min).
 */
export declare function listActiveProfiles(): Promise<MCPProviderProfile[]>;
/**
 * List ALL profiles (active + inactive). Used by admin UI; no cache.
 */
export declare function listAllProfiles(): Promise<MCPProviderProfile[]>;
/**
 * Find a single profile by id. Cached in Redis (5 min).
 * Returns inactive profiles too — callers must check is_active when relevant.
 */
export declare function findProfileById(id: string): Promise<MCPProviderProfile | null>;
/**
 * Find the first active profile that matches the given URL. Iterates over the
 * cached active list in-memory (no extra DB query per call). Returns null if
 * the URL is malformed or no profile matches.
 */
export declare function findProfileByUrl(url: string): Promise<MCPProviderProfile | null>;
/**
 * Resolve auto-injected headers for a profile by reading platform settings
 * and substituting `value_ref` references. Empty platform settings yield an
 * empty-string header value (with a warning log) — the request still goes out
 * but the upstream MCP will probably reject it. Unknown `value_ref` prefixes
 * are dropped.
 */
export declare function resolveAutoHeaders(profile: MCPProviderProfile): Promise<Record<string, string>>;
export interface ProviderCreateInput {
    id: string;
    name: string;
    description?: string;
    logo_url?: string;
    match_url_pattern: string;
    match_strategy: MatchStrategy;
    default_transport: MCPTransport;
    default_server_url?: string;
    auto_injected_headers: AutoInjectedHeader[];
    user_configurable_headers: UserConfigurableHeader[];
    supported_events: string[];
    is_active: boolean;
}
export type ProviderUpdateInput = Partial<Omit<ProviderCreateInput, 'id'>>;
export declare function createProfile(data: ProviderCreateInput): Promise<MCPProviderProfile>;
export declare function updateProfile(id: string, data: ProviderUpdateInput): Promise<MCPProviderProfile | null>;
/**
 * Soft-delete a profile (sets is_active = false). Existing tools that
 * reference it keep their `providerId` but `findProfileById` callers should
 * skip when `!profile.is_active`.
 */
export declare function deleteProfile(id: string): Promise<boolean>;
/**
 * Invalidate the active-list cache and (optionally) a single profile's cache.
 * Pass `id` for targeted invalidation; omit to clear active list only (single
 * profile keys expire naturally on TTL).
 */
export declare function invalidateCache(id?: string): Promise<void>;
/**
 * Strip sensitive fields (auto_injected_headers, match_url_pattern,
 * match_strategy) before exposing to non-admin callers / frontend.
 */
export declare function toPublicProfile(profile: MCPProviderProfile): {
    id: string;
    name: string;
    description?: string;
    logo_url?: string;
    default_server_url?: string;
    default_transport: MCPTransport;
    user_configurable_headers: UserConfigurableHeader[];
    supported_events: string[];
};
//# sourceMappingURL=mcp-providers.service.d.ts.map