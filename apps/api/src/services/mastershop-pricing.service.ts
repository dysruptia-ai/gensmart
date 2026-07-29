/**
 * Mastershop Pricing Service
 *
 * Admin UI backend for the sale-price override system already deployed on
 * the Mastershop MCP (SQLite `product_prices` table, `GET/PUT/DELETE
 * /admin/prices`, plus `GET /admin/products` for the combined read view).
 * Prices themselves are NOT stored in GenSmart's Postgres — this service is
 * only a client of the MCP's admin endpoints.
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

/** Raw shape of a single entry in GET /admin/products. idVariant is -1 (not null) when the product has no variants. */
interface AdminProductRow {
  idProduct: number | string;
  idVariant: number | string;
  nombre: string;
  basePrice: number | null;
  suggestedPrice: number | null;
  salePrice: number | null;
  tieneOverride: boolean;
}

function normalizeVariantId(v: number | string): string | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

/**
 * Fetches the combined catalog + resolved sale price straight from the MCP's
 * `GET /admin/products` — it already merges base/suggested price with any
 * saved override, so no separate call to /admin/prices or to the
 * conversational `search_my_products` tool is needed here (that tool
 * requires session headers this admin context doesn't have).
 */
export async function listCatalogWithPrices(orgId: string, agentId: string): Promise<CatalogPriceRow[]> {
  await verifyAgentOwnership(orgId, agentId);
  // Confirms the agent has a Mastershop tool configured before hitting the MCP.
  await getMastershopTool(agentId);

  const [baseUrl, headers] = await Promise.all([getAdminBaseUrl(), buildAdminHeaders(agentId)]);
  const res = await fetch(`${baseUrl}/admin/products`, { headers });
  if (!res.ok) {
    throw new AppError(res.status, `Mastershop admin API error: ${res.status}`, 'MASTERSHOP_ADMIN_ERROR');
  }
  const data = (await res.json()) as { products?: AdminProductRow[] };
  const products = Array.isArray(data.products) ? data.products : [];

  return products.map((p) => ({
    idProduct: String(p.idProduct),
    idVariant: normalizeVariantId(p.idVariant),
    nombre: p.nombre,
    basePrice: p.basePrice,
    suggestedPrice: p.suggestedPrice,
    salePrice: p.salePrice,
    tieneOverride: p.tieneOverride,
  }));
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
