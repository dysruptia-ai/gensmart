/**
 * Tiendanube auto-provisioning (Dia 3)
 *
 * Called after tiendanube-mcp finishes the OAuth install callback and
 * resolves {storeId, accessToken} on its own side (see migration
 * 047_tiendanube-mcp.sql). GenSmart never sees the access token — it only
 * receives storeId + storefront metadata, and provisions a full Organization
 * for that store: User (new or linked to an existing account) + Organization
 * (billing_source='tiendanube', no Stripe) + Agent from the "WooCommerce
 * Store Assistant" template + MCP connection to the tiendanube provider.
 *
 * Idempotent by storeId: a re-install (same store_id) skips steps 1-4 and
 * only refreshes the encrypted X-Store-ID header on the existing MCP tool
 * (self-healing tool discovery too, if a prior attempt never completed it).
 */
import { randomUUID } from 'crypto';
import { query } from '../config/database';
import { encrypt, decrypt } from '../config/encryption';
import { AppError } from '../middleware/errorHandler';
import * as authService from '../services/auth.service';
import * as agentService from '../services/agent.service';
import { updateContactStage } from '../services/contact.service';
import { encryptHeaders, generateWebhookSecret } from './mcp-headers.service';
import * as platformSettings from './platform-settings.service';
import * as mcpProviders from './mcp-providers.service';
import { connectAndListTools } from './mcp-client.service';

const WOOCOMMERCE_TEMPLATE_NAME = 'WooCommerce Store Assistant';
const TIENDANUBE_PROVIDER_ID = 'tiendanube';
// Overridable for local/staging verification (e.g. a local tiendanube-mcp
// instance) without touching production behavior — defaults unchanged.
const TIENDANUBE_SERVER_URL = process.env['TIENDANUBE_MCP_URL'] ?? 'https://tiendanube-mcp.gensmart.co/mcp';

export interface ProvisionTiendanubeStoreInput {
  storeId: string;
  storeName: string;
  email: string;
  contactName: string;
}

export interface ProvisionTiendanubeStoreResult {
  organizationId: string;
  agentId: string;
  isNewUser: boolean;
  reinstall: boolean;
}

/**
 * Finds an already-provisioned org for this Tiendanube store, if any.
 * Uses (billing_source, external_subscription_id) as the idempotency key.
 */
async function findExistingProvisioning(storeId: string): Promise<{
  organizationId: string;
  agentId: string | null;
} | null> {
  const orgResult = await query<{ id: string }>(
    `SELECT id FROM organizations WHERE billing_source = 'tiendanube' AND external_subscription_id = $1`,
    [storeId]
  );
  const org = orgResult.rows[0];
  if (!org) return null;

  const agentResult = await query<{ id: string }>(
    `SELECT a.id FROM agents a
     JOIN agent_templates t ON t.id = a.template_id
     WHERE a.organization_id = $1 AND t.name = $2
     ORDER BY a.created_at ASC LIMIT 1`,
    [org.id, WOOCOMMERCE_TEMPLATE_NAME]
  );

  return { organizationId: org.id, agentId: agentResult.rows[0]?.id ?? null };
}

/**
 * Reinstall path: refresh the encrypted X-Store-ID header, and self-heal the
 * tools/list discovery if a previous attempt created the tool row but never
 * got to (or failed) the discovery step — same "selected_tools.length === 0"
 * check message.worker.ts/preview use to decide the agent has nothing to call.
 */
async function refreshStoreIdAndEnsureDiscovery(
  organizationId: string,
  agentId: string,
  storeId: string
): Promise<void> {
  const toolResult = await query<{ id: string; config: Record<string, unknown> }>(
    `SELECT id, config FROM agent_tools WHERE agent_id = $1 AND type = 'mcp' AND config->>'providerId' = $2`,
    [agentId, TIENDANUBE_PROVIDER_ID]
  );
  const tool = toolResult.rows[0];
  if (!tool) return;

  const headers = Array.isArray(tool.config['headers']) ? (tool.config['headers'] as unknown[]) : [];
  const filtered = headers.filter(
    (h) => (h as { key?: string }).key !== 'X-Store-ID'
  );
  const newConfig: Record<string, unknown> = {
    ...tool.config,
    headers: [...filtered, { key: 'X-Store-ID', value_encrypted: encrypt(storeId) }],
  };

  await query(`UPDATE agent_tools SET config = $1::jsonb, updated_at = NOW() WHERE id = $2`, [
    JSON.stringify(newConfig),
    tool.id,
  ]);

  const selectedTools = Array.isArray(newConfig['selected_tools']) ? (newConfig['selected_tools'] as unknown[]) : [];
  if (selectedTools.length > 0) return;

  const profile = await mcpProviders.findProfileById(TIENDANUBE_PROVIDER_ID);
  if (!profile || !profile.is_active) {
    throw new AppError(
      500,
      'Tiendanube MCP provider profile not found — apply migration 047_tiendanube-mcp.sql first',
      'MCP_PROVIDER_NOT_FOUND'
    );
  }
  const profileAutoHeaders = await mcpProviders.resolveAutoHeaders(profile);
  const webhookSecretEncrypted = newConfig['webhookSecret_encrypted'] as string | undefined;
  const plainHeaders: Record<string, string> = {
    ...profileAutoHeaders,
    'X-Store-ID': storeId,
    'X-Agent-ID': agentId,
    'X-Session-ID': randomUUID(),
    ...(webhookSecretEncrypted ? { 'X-Webhook-Secret': decrypt(webhookSecretEncrypted) } : {}),
  };

  await discoverAndSaveTools(
    organizationId,
    agentId,
    tool.id,
    newConfig,
    (newConfig['server_url'] as string) ?? TIENDANUBE_SERVER_URL,
    (newConfig['transport'] as 'sse' | 'streamable-http') ?? 'streamable-http',
    plainHeaders
  );
}

/**
 * Runs the same MCP handshake the "Test Connection" button in the editor
 * triggers (tools/list) and persists the discovered tool names into
 * `agent_tools.config.selected_tools` — the field message.worker.ts and the
 * preview endpoint actually gate on (`if (!serverUrl || selectedTools.length
 * === 0) continue;`). Without this, the tool row exists and the MCP is
 * reachable, but the agent never invokes any real function — it only
 * responds generically, because nothing tells it which tools are enabled.
 *
 * Blocking by design: an agent with zero selected_tools is not a degraded
 * feature, it's a non-functional product for the merchant. If the MCP is
 * momentarily unreachable, the whole provisioning call fails visibly
 * (surfaces as a 500 to whoever called /api/internal/tiendanube/provision)
 * instead of silently leaving a broken agent — same reasoning as the
 * blocking POST from tiendanube-mcp's OAuth callback, not the fire-and-forget
 * welcome email (a missing email doesn't make the agent itself non-functional).
 */
async function discoverAndSaveTools(
  organizationId: string,
  agentId: string,
  toolId: string,
  config: Record<string, unknown>,
  serverUrl: string,
  transport: 'sse' | 'streamable-http',
  plainHeaders: Record<string, string>
): Promise<void> {
  const discovered = await connectAndListTools(serverUrl, transport, plainHeaders);
  await agentService.updateTool(organizationId, agentId, toolId, {
    config: { ...config, selected_tools: discovered.map((t) => t.name) },
  });
}

async function connectTiendanubeMcp(
  organizationId: string,
  agentId: string,
  storeId: string
): Promise<void> {
  const profile = await mcpProviders.findProfileById(TIENDANUBE_PROVIDER_ID);
  if (!profile || !profile.is_active) {
    throw new AppError(
      500,
      'Tiendanube MCP provider profile not found — apply migration 047_tiendanube-mcp.sql first',
      'MCP_PROVIDER_NOT_FOUND'
    );
  }

  const plainWebhookSecret = generateWebhookSecret();
  const config = {
    server_url: TIENDANUBE_SERVER_URL,
    name: 'Tiendanube Store',
    transport: 'streamable-http',
    selected_tools: [] as string[],
    headers: encryptHeaders([{ key: 'X-Store-ID', value: storeId }]),
    webhookSecret_encrypted: encrypt(plainWebhookSecret),
    providerId: TIENDANUBE_PROVIDER_ID,
  };

  const tool = await agentService.createTool(organizationId, agentId, {
    type: 'mcp',
    name: 'Tiendanube Store',
    description: 'Conexión automática al MCP de Tiendanube — búsqueda de productos y creación de pedidos.',
    config,
  });

  // Same 3-layer header merge used by test-connection/preview/worker: profile
  // auto-injected headers (master API key) → user headers (X-Store-ID) →
  // system headers (agent/session identity + webhook secret, plaintext here
  // since we just generated them, no need to decrypt anything).
  const profileAutoHeaders = await mcpProviders.resolveAutoHeaders(profile);
  const plainHeaders: Record<string, string> = {
    ...profileAutoHeaders,
    'X-Store-ID': storeId,
    'X-Agent-ID': agentId,
    'X-Session-ID': randomUUID(),
    'X-Webhook-Secret': plainWebhookSecret,
  };

  await discoverAndSaveTools(
    organizationId,
    agentId,
    tool.id,
    config,
    TIENDANUBE_SERVER_URL,
    'streamable-http',
    plainHeaders
  );
}

async function findOwnerUserId(organizationId: string): Promise<string> {
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM user_organizations WHERE organization_id = $1 AND role = 'owner' ORDER BY created_at ASC LIMIT 1`,
    [organizationId]
  );
  const ownerId = result.rows[0]?.user_id;
  if (!ownerId) {
    throw new AppError(500, 'Organization has no owner in user_organizations', 'ORG_OWNER_NOT_FOUND');
  }
  return ownerId;
}

async function createAgentAndMcpConnection(
  organizationId: string,
  ownerUserId: string,
  storeId: string,
  storeName: string
): Promise<string> {
  const templateResult = await query<{ id: string }>(
    `SELECT id FROM agent_templates WHERE name = $1 AND is_active = true LIMIT 1`,
    [WOOCOMMERCE_TEMPLATE_NAME]
  );
  const template = templateResult.rows[0];
  if (!template) {
    throw new AppError(
      500,
      `Agent template "${WOOCOMMERCE_TEMPLATE_NAME}" not found — run the seed script first`,
      'TEMPLATE_NOT_FOUND'
    );
  }

  const agent = await agentService.createFromTemplate(organizationId, 'pro', template.id);

  // The template's own name/description reference WooCommerce (it's a
  // generic e-commerce clone until a dedicated "Tiendanube Store Assistant"
  // template exists — pending content work, see Dia 3 report). Override what
  // the merchant actually sees so nothing WooCommerce-branded leaks through.
  await agentService.updateAgent(organizationId, agent.id, {
    name: `Agente de Ventas — ${storeName}`,
    description: `Asesora de ventas por WhatsApp para ${storeName} — búsqueda de productos, envíos y creación de pedidos con el link de pago de tu tienda Tiendanube.`,
  });

  await agentService.patchConfigValues(organizationId, agent.id, {
    nombre_tienda: storeName,
    // tipo_negocio is required by the template schema (no default) but
    // Tiendanube's store metadata has no equivalent field to autofill it
    // from — a generic placeholder unblocks auto-publish; the merchant can
    // refine it later in the Configuration tab.
    tipo_negocio: 'tienda online',
  });

  await connectTiendanubeMcp(organizationId, agent.id, storeId);

  // Auto-provisioned orgs skip the manual "Publish" click a normal signup
  // would require — the merchant expects the agent to be live already.
  await agentService.publishAgent(organizationId, agent.id, ownerUserId);

  return agent.id;
}

export async function provisionTiendanubeStore(
  input: ProvisionTiendanubeStoreInput
): Promise<ProvisionTiendanubeStoreResult> {
  const existing = await findExistingProvisioning(input.storeId);
  if (existing) {
    // Reinstall of a fully-provisioned store: refresh the store_id header
    // (Tiendanube may have re-issued a fresh access_token on its side), and
    // self-heal tool discovery if a prior attempt never completed it.
    if (existing.agentId) {
      await refreshStoreIdAndEnsureDiscovery(existing.organizationId, existing.agentId, input.storeId);
      return {
        organizationId: existing.organizationId,
        agentId: existing.agentId,
        isNewUser: false,
        reinstall: true,
      };
    }

    // Org exists but the agent/MCP step never completed (e.g. a previous
    // attempt crashed between steps 1 and 3-4) — finish it instead of
    // silently leaving the org without an agent.
    const ownerUserId = await findOwnerUserId(existing.organizationId);
    const agentId = await createAgentAndMcpConnection(existing.organizationId, ownerUserId, input.storeId, input.storeName);
    return { organizationId: existing.organizationId, agentId, isNewUser: false, reinstall: true };
  }

  // 1. User (new or linked) + Organization, billing_source='tiendanube', plan='pro'
  const { userId, organizationId, isNewUser } = await authService.provisionOrganization({
    email: input.email,
    name: input.contactName,
    organizationName: input.storeName,
    plan: 'pro',
    billingSource: 'tiendanube',
    externalSubscriptionId: input.storeId,
  });

  // 2. Email de acceso (magic link, no password)
  await authService.sendOrgAccessLinkEmail(userId, organizationId, input.storeName);

  // 3-4. Agent desde template WooCommerce Store Assistant + conexión MCP
  const agentId = await createAgentAndMcpConnection(organizationId, userId, input.storeId, input.storeName);

  return { organizationId, agentId, isNewUser, reinstall: false };
}

export interface ToggleTiendanubeToolResult {
  organizationId: string;
  agentId: string;
  toolId: string;
  isEnabled: boolean;
}

/**
 * Reflects Tiendanube's app/suspended|resumed|uninstalled webhooks (Dia 6,
 * built in parallel) into GenSmart without touching the Organization itself
 * — the merchant's dashboard, conversations, and other agents (if any) stay
 * intact. Only the tiendanube MCP tool row is toggled.
 *
 * is_enabled=false is a real runtime block, not a cosmetic editor-only
 * hide: message.worker.ts loads tools via
 * `SELECT ... FROM agent_tools WHERE agent_id = $1 AND is_enabled = true`,
 * so a disabled tool's row never even reaches the agent's tool list — same
 * query shape in the preview endpoint.
 */
export async function toggleTiendanubeTool(
  storeId: string,
  enabled: boolean
): Promise<ToggleTiendanubeToolResult> {
  const orgResult = await query<{ id: string }>(
    `SELECT id FROM organizations WHERE billing_source = 'tiendanube' AND external_subscription_id = $1`,
    [storeId]
  );
  const org = orgResult.rows[0];
  if (!org) {
    throw new AppError(404, `No organization found for Tiendanube store ${storeId}`, 'ORG_NOT_FOUND');
  }

  const toolResult = await query<{ id: string; agent_id: string }>(
    `SELECT t.id, t.agent_id
     FROM agent_tools t
     JOIN agents a ON a.id = t.agent_id
     WHERE a.organization_id = $1 AND t.type = 'mcp' AND t.config->>'providerId' = $2
     ORDER BY t.created_at ASC LIMIT 1`,
    [org.id, TIENDANUBE_PROVIDER_ID]
  );
  const tool = toolResult.rows[0];
  if (!tool) {
    throw new AppError(404, `No Tiendanube MCP tool found for store ${storeId}`, 'TOOL_NOT_FOUND');
  }

  await agentService.updateTool(org.id, tool.agent_id, tool.id, { isEnabled: enabled });

  return { organizationId: org.id, agentId: tool.agent_id, toolId: tool.id, isEnabled: enabled };
}

export interface MarkTiendanubeCustomerResult {
  organizationId: string;
  contactId: string | null;
  updated: boolean;
}

/**
 * Reflects a Tiendanube order/paid webhook onto the funnel: moves the
 * matching Contact to funnel_stage='customer'. GenSmart does not store the
 * order itself — Tiendanube remains the system of record for the sale, same
 * as Mastershop/WooCommerce. Reuses updateContactStage() as-is (the same
 * function PUT /contacts/:id/stage and PUT /funnel/move already call).
 *
 * No match (or ambiguous match, resolved by picking the most recent contact)
 * is a silent no-op, not an error — we don't create a Contact just for this.
 */
export async function markTiendanubeCustomer(
  storeId: string,
  email: string | undefined,
  phone: string | undefined
): Promise<MarkTiendanubeCustomerResult> {
  const orgResult = await query<{ id: string }>(
    `SELECT id FROM organizations WHERE billing_source = 'tiendanube' AND external_subscription_id = $1`,
    [storeId]
  );
  const org = orgResult.rows[0];
  if (!org) {
    throw new AppError(404, `No organization found for Tiendanube store ${storeId}`, 'ORG_NOT_FOUND');
  }

  if (!email && !phone) {
    return { organizationId: org.id, contactId: null, updated: false };
  }

  const conditions: string[] = [];
  const params: unknown[] = [org.id];
  if (email) {
    params.push(email);
    conditions.push(`email = $${params.length}`);
  }
  if (phone) {
    params.push(phone);
    conditions.push(`phone = $${params.length}`);
  }

  const contactResult = await query<{ id: string; funnel_stage: string }>(
    `SELECT id, funnel_stage FROM contacts
     WHERE organization_id = $1 AND (${conditions.join(' OR ')})
     ORDER BY created_at DESC LIMIT 1`,
    params
  );
  const contact = contactResult.rows[0];
  if (!contact) {
    return { organizationId: org.id, contactId: null, updated: false };
  }

  if (contact.funnel_stage === 'customer') {
    return { organizationId: org.id, contactId: contact.id, updated: false };
  }

  await updateContactStage(org.id, contact.id, 'customer');
  return { organizationId: org.id, contactId: contact.id, updated: true };
}

export async function verifyInternalProvisioningSecret(providedKey: string | undefined): Promise<boolean> {
  if (!providedKey) return false;
  try {
    const masterKey = await platformSettings.getSettingValue('tiendanube_mcp_api_key');
    return masterKey.length > 0 && providedKey === masterKey;
  } catch {
    return false;
  }
}
