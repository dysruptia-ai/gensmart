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
 * only refreshes the encrypted X-Store-ID header on the existing MCP tool.
 */
import { query } from '../config/database';
import { encrypt } from '../config/encryption';
import { AppError } from '../middleware/errorHandler';
import * as authService from '../services/auth.service';
import * as agentService from '../services/agent.service';
import { encryptHeaders, generateWebhookSecret } from './mcp-headers.service';
import * as platformSettings from './platform-settings.service';

const WOOCOMMERCE_TEMPLATE_NAME = 'WooCommerce Store Assistant';
const TIENDANUBE_PROVIDER_ID = 'tiendanube';
const TIENDANUBE_SERVER_URL = 'https://tiendanube-mcp.gensmart.co/mcp';

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

async function refreshStoreIdHeader(agentId: string, storeId: string): Promise<void> {
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
  const newConfig = {
    ...tool.config,
    headers: [...filtered, { key: 'X-Store-ID', value_encrypted: encrypt(storeId) }],
  };

  await query(`UPDATE agent_tools SET config = $1::jsonb, updated_at = NOW() WHERE id = $2`, [
    JSON.stringify(newConfig),
    tool.id,
  ]);
}

async function connectTiendanubeMcp(
  organizationId: string,
  agentId: string,
  storeId: string
): Promise<void> {
  const profileResult = await query<{ id: string }>(
    `SELECT id FROM mcp_provider_profiles WHERE id = $1 AND is_active = true`,
    [TIENDANUBE_PROVIDER_ID]
  );
  if (!profileResult.rows[0]) {
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
    selected_tools: [],
    headers: encryptHeaders([{ key: 'X-Store-ID', value: storeId }]),
    webhookSecret_encrypted: encrypt(plainWebhookSecret),
    providerId: TIENDANUBE_PROVIDER_ID,
  };

  await agentService.createTool(organizationId, agentId, {
    type: 'mcp',
    name: 'Tiendanube Store',
    description: 'Conexión automática al MCP de Tiendanube — búsqueda de productos y creación de pedidos.',
    config,
  });
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
    // Reinstall of a fully-provisioned store: just refresh the store_id
    // header (Tiendanube may have re-issued a fresh access_token on its side).
    if (existing.agentId) {
      await refreshStoreIdHeader(existing.agentId, input.storeId);
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

export async function verifyInternalProvisioningSecret(providedKey: string | undefined): Promise<boolean> {
  if (!providedKey) return false;
  try {
    const masterKey = await platformSettings.getSettingValue('tiendanube_mcp_api_key');
    return masterKey.length > 0 && providedKey === masterKey;
  } catch {
    return false;
  }
}
