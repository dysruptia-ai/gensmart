import { query } from '../config/database';
import {
  injectConfigVariables,
  mergeConfigVariablesSchema,
  type ConfigVariableSchema,
  type ConfigVariableValues,
} from '@gensmart/shared';

// Centralizes the merge + inject logic so worker, preview route, and publish
// guard all agree on what the "effective" schema/prompt looks like for a
// given agent. Single source of truth — keeps worker and preview in sync.

interface AgentConfigRow {
  template_id: string | null;
  config_variables_schema_overrides: unknown;
  config_variables_values: unknown;
}

interface TemplateConfigRow {
  config_variables_schema: unknown;
}

function toSchemaArray(value: unknown): ConfigVariableSchema[] {
  return Array.isArray(value) ? (value as ConfigVariableSchema[]) : [];
}

function toValues(value: unknown): ConfigVariableValues {
  return value && typeof value === 'object' ? (value as ConfigVariableValues) : {};
}

export interface AgentConfigContext {
  schema: ConfigVariableSchema[];
  values: ConfigVariableValues;
  templateId: string | null;
}

/**
 * Load the effective config schema (template ⨁ overrides) + values for an
 * agent. Returns empty schema/values if the agent doesn't exist (caller is
 * expected to have already validated existence; this is best-effort).
 */
export async function loadAgentConfigContext(agentId: string): Promise<AgentConfigContext> {
  const agentRes = await query<AgentConfigRow>(
    'SELECT template_id, config_variables_schema_overrides, config_variables_values FROM agents WHERE id = $1',
    [agentId]
  );
  const agent = agentRes.rows[0];
  if (!agent) return { schema: [], values: {}, templateId: null };

  let templateSchema: ConfigVariableSchema[] = [];
  if (agent.template_id) {
    const tplRes = await query<TemplateConfigRow>(
      'SELECT config_variables_schema FROM agent_templates WHERE id = $1',
      [agent.template_id]
    );
    templateSchema = toSchemaArray(tplRes.rows[0]?.config_variables_schema);
  }

  const overrides = toSchemaArray(agent.config_variables_schema_overrides);
  const schema = mergeConfigVariablesSchema(templateSchema, overrides);
  const values = toValues(agent.config_variables_values);

  return { schema, values, templateId: agent.template_id };
}

/**
 * Apply config variable substitution to a raw system prompt for a given agent.
 * Worker and preview route both call this so they cannot drift.
 */
export async function renderSystemPromptWithConfig(
  agentId: string,
  rawSystemPrompt: string
): Promise<string> {
  const ctx = await loadAgentConfigContext(agentId);
  return injectConfigVariables(rawSystemPrompt, ctx.schema, ctx.values);
}

/**
 * Return the effective schema + values for an agent, ready to pass into
 * injectConfigVariablesDeep. Mirrors renderSystemPromptWithConfig but exposes
 * the raw context so callers can substitute into arbitrary config objects
 * (e.g. Custom Function tool configs with {{config.*}} placeholders).
 */
export async function loadAgentConfigForDeepInject(
  agentId: string
): Promise<{ schema: ConfigVariableSchema[]; values: ConfigVariableValues }> {
  const ctx = await loadAgentConfigContext(agentId);
  return { schema: ctx.schema, values: ctx.values };
}

export interface CTWAReferral {
  source_url?: string;
  source_type?: string;
  source_id?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
}

/**
 * Builds the "ad context" system prompt block for a Click-to-WhatsApp Ad
 * referral, or returns null when there's nothing worth injecting (no
 * referral, or a referral with neither headline nor body — Meta sometimes
 * sends a bare source_id with no human-readable content). Worker and
 * preview route both call this so they cannot drift.
 */
export function buildAdReferralContext(
  referral: CTWAReferral | undefined,
  referredProduct: unknown
): string | null {
  if (!referral || (!referral.headline && !referral.body)) return null;

  let block =
    `Contexto del anuncio (Click-to-WhatsApp Ad)\n\n` +
    `Este cliente llegó a través de un anuncio de Meta. Datos disponibles del anuncio:\n\n` +
    `Título: ${referral.headline ?? 'no disponible'}\n` +
    `Descripción: ${referral.body ?? 'no disponible'}\n` +
    `URL de origen: ${referral.source_url ?? 'no disponible'}\n`;

  if (referredProduct !== undefined && referredProduct !== null) {
    block += `Producto declarado por el anuncio (datos crudos): ${JSON.stringify(referredProduct)}\n`;
  }

  block +=
    `\nEste contexto tiene PRIORIDAD sobre tu lógica genérica de saludo: en tu primer ` +
    `mensaje de esta conversación, saluda y conecta directamente con el producto o tema ` +
    `de este anuncio — incluso si es distinto al producto estrella configurado para esta ` +
    `tienda. Si el anuncio no identifica un producto exacto por ID, usa tu herramienta de ` +
    `búsqueda de productos con las palabras clave del título o la descripción para ` +
    `encontrarlo antes de presentarlo. No asumas que el producto del anuncio es el mismo ` +
    `que tu producto estrella configurado sin confirmarlo.`;

  return block;
}
