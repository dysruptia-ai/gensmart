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
