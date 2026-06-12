"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAgentConfigContext = loadAgentConfigContext;
exports.renderSystemPromptWithConfig = renderSystemPromptWithConfig;
exports.loadAgentConfigForDeepInject = loadAgentConfigForDeepInject;
const database_1 = require("../config/database");
const shared_1 = require("@gensmart/shared");
function toSchemaArray(value) {
    return Array.isArray(value) ? value : [];
}
function toValues(value) {
    return value && typeof value === 'object' ? value : {};
}
/**
 * Load the effective config schema (template ⨁ overrides) + values for an
 * agent. Returns empty schema/values if the agent doesn't exist (caller is
 * expected to have already validated existence; this is best-effort).
 */
async function loadAgentConfigContext(agentId) {
    const agentRes = await (0, database_1.query)('SELECT template_id, config_variables_schema_overrides, config_variables_values FROM agents WHERE id = $1', [agentId]);
    const agent = agentRes.rows[0];
    if (!agent)
        return { schema: [], values: {}, templateId: null };
    let templateSchema = [];
    if (agent.template_id) {
        const tplRes = await (0, database_1.query)('SELECT config_variables_schema FROM agent_templates WHERE id = $1', [agent.template_id]);
        templateSchema = toSchemaArray(tplRes.rows[0]?.config_variables_schema);
    }
    const overrides = toSchemaArray(agent.config_variables_schema_overrides);
    const schema = (0, shared_1.mergeConfigVariablesSchema)(templateSchema, overrides);
    const values = toValues(agent.config_variables_values);
    return { schema, values, templateId: agent.template_id };
}
/**
 * Apply config variable substitution to a raw system prompt for a given agent.
 * Worker and preview route both call this so they cannot drift.
 */
async function renderSystemPromptWithConfig(agentId, rawSystemPrompt) {
    const ctx = await loadAgentConfigContext(agentId);
    return (0, shared_1.injectConfigVariables)(rawSystemPrompt, ctx.schema, ctx.values);
}
/**
 * Return the effective schema + values for an agent, ready to pass into
 * injectConfigVariablesDeep. Mirrors renderSystemPromptWithConfig but exposes
 * the raw context so callers can substitute into arbitrary config objects
 * (e.g. Custom Function tool configs with {{config.*}} placeholders).
 */
async function loadAgentConfigForDeepInject(agentId) {
    const ctx = await loadAgentConfigContext(agentId);
    return { schema: ctx.schema, values: ctx.values };
}
//# sourceMappingURL=agent-config.service.js.map