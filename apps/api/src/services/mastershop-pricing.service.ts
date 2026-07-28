/**
 * Mastershop Pricing Service
 *
 * Admin UI backend for the sale-price override system already deployed on
 * the Mastershop MCP (SQLite `product_prices` table, `GET/PUT/DELETE
 * /admin/prices`). Prices themselves are NOT stored in GenSmart's Postgres —
 * this service is only a client of the MCP's admin endpoints plus the
 * existing `search_my_products` tool for the read-only base catalog.
 *
 * Auth to the MCP admin endpoints requires two headers:
 *   - X-MCP-API-Key       — platform-level master key. Reuses the SAME
 *     `mastershop` provider profile (migration 038) already used for the
 *     agent's runtime tool calls — resolved via
 *     mcp-providers.service.resolveAutoHeaders(), backed by the platform
 *     setting `mastershop_mcp_api_key`. There is no separate
 *     "mastershop_mcp_master_key" setting; that would duplicate this one.
 *   - X-Mastershop-Api-Key — tenant key, already stored encrypted in the
 *     agent's "Mastershop MCP" tool config.headers (see migration 038's
 *     user_configurable_headers). Decrypted via mcp-headers.service.
 */

import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { decryptHeaders, type EncryptedHeader } from './mcp-headers.service';
import * as mcpProviders from './mcp-providers.service';
import { executeMCPTool } from './mcp-client.service';

const MASTERSHOP_PROVIDER_ID = 'mastershop';
const TENANT_KEY_HEADER = 'X-Mastershop-Api-Key';

interface MastershopToolConfig {
  server_url?: string;
  serverUrl?: string;
  transport?: string;
  providerId?: string;
  headers?: EncryptedHeader[];
}

interface MastershopToolRow {
  id: string;
  name: string;
  config: MastershopToolConfig;
}

export interface CatalogPriceRow {
  idProduct: string;
  idVariant: string | null;
  nombre: string;
  basePrice: number | null;
  suggestedPrice: number | null;
  salePrice: number | null;
  tieneOverride: boolean;
}

/**
 * Finds the agent's configured Mastershop MCP tool (matched by provider
 * profile id, falling back to a name match for tools created before the
 * provider-profile system existed). Throws a 400 AppError if not found —
 * both routes below surface this directly to the frontend.
 */
async function verifyAgentOwnership(orgId: string, agentId: string): Promise<void> {
  const result = await query<{ id: string }>(
    'SELECT id FROM agents WHERE id = $1 AND organization_id = $2',
    [agentId, orgId]
  );
  if (!result.rows[0]) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
}

async function getMastershopTool(agentId: string): Promise<MastershopToolRow> {
  const result = await query<MastershopToolRow>(
    `SELECT id, name, config FROM agent_tools
     WHERE agent_id = $1 AND type = 'mcp' AND is_enabled = true`,
    [agentId]
  );

  const tool = result.rows.find((t) => {
    const providerId = t.config?.providerId;
    if (providerId) return providerId === MASTERSHOP_PROVIDER_ID;
    return t.name.toLowerCase().includes('mastershop');
  });

  if (!tool) {
    throw new AppError(400, 'Este agente no tiene Mastershop conectado', 'MASTERSHOP_NOT_CONNECTED');
  }
  return tool;
}

/** Tenant's own Mastershop API key, decrypted from the tool's stored headers. */
export async function getTenantMastershopKey(agentId: string): Promise<string | null> {
  const tool = await getMastershopTool(agentId);
  const decrypted = decryptHeaders(tool.config.headers);
  return decrypted[TENANT_KEY_HEADER] ?? null;
}

/** Platform master key for the MCP's /admin/* endpoints. */
export async function getPlatformMcpKey(): Promise<string> {
  const profile = await mcpProviders.findProfileById(MASTERSHOP_PROVIDER_ID);
  if (!profile) {
    throw new AppError(500, 'Mastershop provider profile not configured', 'PROVIDER_NOT_FOUND');
  }
  const headers = await mcpProviders.resolveAutoHeaders(profile);
  const key = headers['X-MCP-API-Key'];
  if (!key) {
    throw new AppError(500, 'Mastershop platform master key is not configured', 'PLATFORM_KEY_MISSING');
  }
  return key;
}

/** Derives the MCP's admin base URL from the provider profile's server URL. */
async function getAdminBaseUrl(): Promise<string> {
  const profile = await mcpProviders.findProfileById(MASTERSHOP_PROVIDER_ID);
  const serverUrl = profile?.default_server_url ?? 'https://mastershop-mcp.gensmart.co/mcp';
  return serverUrl.replace(/\/mcp\/?$/, '');
}

async function buildAdminHeaders(agentId: string): Promise<Record<string, string>> {
  const [platformKey, tenantKey] = await Promise.all([
    getPlatformMcpKey(),
    getTenantMastershopKey(agentId),
  ]);
  if (!tenantKey) {
    throw new AppError(400, 'Este agente no tiene Mastershop conectado', 'MASTERSHOP_NOT_CONNECTED');
  }
  return {
    'X-MCP-API-Key': platformKey,
    [TENANT_KEY_HEADER]: tenantKey,
    'Content-Type': 'application/json',
  };
}

interface AdminPriceOverride {
  idProduct: string;
  idVariant: string | null;
  salePrice: number;
}

async function fetchPriceOverrides(agentId: string): Promise<AdminPriceOverride[]> {
  const [baseUrl, headers] = await Promise.all([getAdminBaseUrl(), buildAdminHeaders(agentId)]);
  const res = await fetch(`${baseUrl}/admin/prices`, { headers });
  if (!res.ok) {
    throw new AppError(res.status, `Mastershop admin API error: ${res.status}`, 'MASTERSHOP_ADMIN_ERROR');
  }
  const data = (await res.json()) as { prices?: AdminPriceOverride[] } | AdminPriceOverride[];
  return Array.isArray(data) ? data : (data.prices ?? []);
}

/**
 * Best-effort normalization of a single catalog entry returned by
 * `search_my_products`. Field names below (price/basePrice/suggestedPrice)
 * are the MCP's documented product shape as of this writing — verify against
 * a live tool call if Mastershop's schema has since changed.
 */
function normalizeCatalogEntry(raw: Record<string, unknown>): {
  idProduct: string;
  idVariant: string | null;
  nombre: string;
  basePrice: number | null;
  suggestedPrice: number | null;
} {
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : null);
  return {
    idProduct: String(raw['idProduct'] ?? raw['id'] ?? ''),
    idVariant: raw['idVariant'] != null ? String(raw['idVariant']) : null,
    nombre: String(raw['name'] ?? raw['nombre'] ?? ''),
    basePrice: num(raw['basePrice'] ?? raw['price'] ?? raw['cost']),
    suggestedPrice: num(raw['suggestedPrice'] ?? raw['retailPrice'] ?? raw['price']),
  };
}

function catalogKey(idProduct: string, idVariant: string | null): string {
  return `${idProduct}::${idVariant ?? ''}`;
}

/**
 * Combines the read-only base catalog (via the existing `search_my_products`
 * MCP tool — same mechanism the worker uses at conversation time) with saved
 * sale-price overrides (via the MCP's /admin/prices endpoint).
 */
export async function listCatalogWithPrices(orgId: string, agentId: string): Promise<CatalogPriceRow[]> {
  await verifyAgentOwnership(orgId, agentId);
  const tool = await getMastershopTool(agentId);
  const cfg = tool.config;
  const serverUrl = cfg.server_url ?? cfg.serverUrl ?? '';
  const transport = cfg.transport === 'streamable-http' ? 'streamable-http' : 'sse';

  const [platformKey, tenantKey] = await Promise.all([
    getPlatformMcpKey(),
    getTenantMastershopKey(agentId),
  ]);
  if (!tenantKey) {
    throw new AppError(400, 'Este agente no tiene Mastershop conectado', 'MASTERSHOP_NOT_CONNECTED');
  }
  const toolHeaders = { 'X-MCP-API-Key': platformKey, [TENANT_KEY_HEADER]: tenantKey };

  const [catalogResult, overrides] = await Promise.all([
    executeMCPTool(serverUrl, 'search_my_products', { search: '', limit: 100 }, transport, toolHeaders),
    fetchPriceOverrides(agentId),
  ]);

  let catalogRaw: Record<string, unknown>[] = [];
  try {
    const parsed = JSON.parse(catalogResult.content) as unknown;
    const list = Array.isArray(parsed) ? parsed : (parsed as { products?: unknown[] })?.products;
    catalogRaw = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
  } catch (err) {
    console.error(`[mastershop-pricing] Failed to parse catalog response for agent ${agentId}:`, (err as Error).message);
  }

  const overrideMap = new Map<string, AdminPriceOverride>();
  for (const o of overrides) {
    overrideMap.set(catalogKey(o.idProduct, o.idVariant), o);
  }

  return catalogRaw.map((raw) => {
    const entry = normalizeCatalogEntry(raw);
    const override = overrideMap.get(catalogKey(entry.idProduct, entry.idVariant));
    return {
      idProduct: entry.idProduct,
      idVariant: entry.idVariant,
      nombre: entry.nombre,
      basePrice: entry.basePrice,
      suggestedPrice: entry.suggestedPrice,
      salePrice: override?.salePrice ?? entry.suggestedPrice,
      tieneOverride: !!override,
    };
  });
}

export interface PriceUpdateInput {
  idProduct: string;
  idVariant: string | null;
  salePrice: number;
}

export async function updatePrices(orgId: string, agentId: string, prices: PriceUpdateInput[]): Promise<void> {
  await verifyAgentOwnership(orgId, agentId);
  const [baseUrl, headers] = await Promise.all([getAdminBaseUrl(), buildAdminHeaders(agentId)]);

  // The MCP rejects any non-null idVariant it doesn't recognize — normalize
  // falsy values (undefined, '', 0-as-placeholder) to null explicitly.
  const normalized = prices.map((p) => ({
    idProduct: p.idProduct,
    idVariant: p.idVariant || null,
    salePrice: p.salePrice,
  }));

  const res = await fetch(`${baseUrl}/admin/prices`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ prices: normalized }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AppError(res.status, `Mastershop admin API error: ${res.status} ${body}`, 'MASTERSHOP_ADMIN_ERROR');
  }
}
