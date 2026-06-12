"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgents = getAgents;
exports.getAgentById = getAgentById;
exports.createAgent = createAgent;
exports.updateAgent = updateAgent;
exports.deleteAgent = deleteAgent;
exports.publishAgent = publishAgent;
exports.getVersions = getVersions;
exports.rollbackAgent = rollbackAgent;
exports.getTemplates = getTemplates;
exports.createFromTemplate = createFromTemplate;
exports.getConfigSchema = getConfigSchema;
exports.patchConfigValues = patchConfigValues;
exports.replaceConfigOverrides = replaceConfigOverrides;
exports.getMissingRequiredConfig = getMissingRequiredConfig;
exports.getTools = getTools;
exports.createTool = createTool;
exports.updateTool = updateTool;
exports.deleteTool = deleteTool;
exports.duplicateAgent = duplicateAgent;
exports.countToolsByType = countToolsByType;
exports.getKnowledgeFiles = getKnowledgeFiles;
exports.createKnowledgeFile = createKnowledgeFile;
exports.createKnowledgeFileFromUrl = createKnowledgeFileFromUrl;
exports.reprocessKnowledgeFile = reprocessKnowledgeFile;
exports.deleteKnowledgeFile = deleteKnowledgeFile;
exports.previewAgent = previewAgent;
exports.testTool = testTool;
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
const shared_1 = require("@gensmart/shared");
function formatTool(row) {
    return {
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        name: row.name,
        description: row.description,
        config: row.config,
        isEnabled: row.is_enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function makeInitials(name) {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
}
function formatAgent(row) {
    return {
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        description: row.description,
        avatarUrl: row.avatar_url,
        avatarInitials: row.avatar_initials ?? makeInitials(row.name),
        systemPrompt: row.system_prompt,
        llmProvider: row.llm_provider,
        llmModel: row.llm_model,
        temperature: parseFloat(row.temperature),
        maxTokens: row.max_tokens,
        contextWindowMessages: row.context_window_messages,
        status: row.status,
        channels: row.channels ?? [],
        messageBufferSeconds: row.message_buffer_seconds,
        variables: row.variables ?? [],
        webConfig: row.web_config,
        whatsappConfig: row.whatsapp_config,
        templateId: row.template_id,
        configVariablesValues: row.config_variables_values && typeof row.config_variables_values === 'object'
            ? row.config_variables_values
            : {},
        configVariablesSchemaOverrides: Array.isArray(row.config_variables_schema_overrides)
            ? row.config_variables_schema_overrides
            : [],
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
async function getAgents(orgId, filters) {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 20, 100);
    const offset = (page - 1) * limit;
    const params = [orgId];
    const conditions = ['a.organization_id = $1'];
    if (filters?.search) {
        params.push(`%${filters.search}%`);
        conditions.push(`(a.name ILIKE $${params.length} OR a.description ILIKE $${params.length})`);
    }
    if (filters?.status) {
        params.push(filters.status);
        conditions.push(`a.status = $${params.length}`);
    }
    if (filters?.channel) {
        params.push(JSON.stringify([filters.channel]));
        conditions.push(`a.channels @> $${params.length}::jsonb`);
    }
    const whereClause = conditions.join(' AND ');
    const countResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM agents a WHERE ${whereClause}`, params);
    params.push(limit, offset);
    const result = await (0, database_1.query)(`SELECT * FROM agents a WHERE ${whereClause}
     ORDER BY a.updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return {
        agents: result.rows.map(formatAgent),
        total: parseInt(countResult.rows[0]?.count ?? '0', 10),
        page,
        limit,
    };
}
async function getAgentById(orgId, agentId) {
    const result = await (0, database_1.query)('SELECT * FROM agents WHERE id = $1 AND organization_id = $2', [agentId, orgId]);
    const agent = result.rows[0];
    if (!agent)
        throw new errorHandler_1.AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
    const toolsResult = await (0, database_1.query)('SELECT * FROM agent_tools WHERE agent_id = $1 ORDER BY created_at ASC', [agentId]);
    return { ...formatAgent(agent), tools: toolsResult.rows.map(formatTool) };
}
async function createAgent(orgId, plan, data) {
    const planLimits = shared_1.PLAN_LIMITS[plan];
    if (planLimits) {
        const countResult = await (0, database_1.query)('SELECT COUNT(*) as count FROM agents WHERE organization_id = $1', [orgId]);
        const currentCount = parseInt(countResult.rows[0]?.count ?? '0', 10);
        const agentLimit = planLimits.agents;
        if (agentLimit !== Infinity && currentCount >= agentLimit) {
            throw new errorHandler_1.AppError(403, `Your plan allows a maximum of ${agentLimit} agent(s). Upgrade to create more.`, 'PLAN_LIMIT_REACHED');
        }
    }
    const initials = makeInitials(data.name);
    const result = await (0, database_1.query)(`INSERT INTO agents (
      organization_id, name, description, avatar_initials, system_prompt,
      llm_provider, llm_model, temperature, max_tokens, context_window_messages,
      status, channels, message_buffer_seconds, variables, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12,$13,NOW(),NOW())
    RETURNING *`, [
        orgId,
        data.name,
        data.description ?? null,
        initials,
        data.systemPrompt,
        data.llmProvider,
        data.llmModel,
        data.temperature ?? 0.7,
        data.maxTokens ?? 1024,
        data.contextWindowMessages ?? 15,
        JSON.stringify(data.channels ?? []),
        data.messageBufferSeconds ?? 5,
        JSON.stringify(data.variables ?? []),
    ]);
    return formatAgent(result.rows[0]);
}
async function updateAgent(orgId, agentId, data) {
    const existing = await (0, database_1.query)('SELECT * FROM agents WHERE id = $1 AND organization_id = $2', [agentId, orgId]);
    if (!existing.rows[0])
        throw new errorHandler_1.AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
    const fieldMap = {
        name: 'name',
        description: 'description',
        avatarUrl: 'avatar_url',
        systemPrompt: 'system_prompt',
        llmProvider: 'llm_provider',
        llmModel: 'llm_model',
        temperature: 'temperature',
        maxTokens: 'max_tokens',
        contextWindowMessages: 'context_window_messages',
        channels: 'channels',
        messageBufferSeconds: 'message_buffer_seconds',
        variables: 'variables',
        webConfig: 'web_config',
        whatsappConfig: 'whatsapp_config',
        status: 'status',
    };
    const jsonFields = new Set(['channels', 'variables', 'webConfig', 'whatsappConfig']);
    const setClauses = [];
    const params = [];
    for (const [jsKey, sqlCol] of Object.entries(fieldMap)) {
        if (jsKey in data) {
            params.push(jsonFields.has(jsKey) ? JSON.stringify(data[jsKey]) : data[jsKey]);
            setClauses.push(`${sqlCol} = $${params.length}`);
        }
    }
    if (setClauses.length === 0)
        return formatAgent(existing.rows[0]);
    params.push(agentId, orgId);
    const result = await (0, database_1.query)(`UPDATE agents SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND organization_id = $${params.length}
     RETURNING *`, params);
    return formatAgent(result.rows[0]);
}
async function deleteAgent(orgId, agentId) {
    const existing = await (0, database_1.query)('SELECT id FROM agents WHERE id = $1 AND organization_id = $2', [agentId, orgId]);
    if (!existing.rows[0])
        throw new errorHandler_1.AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
    const activeConvs = await (0, database_1.query)(`SELECT COUNT(*) as count FROM conversations
     WHERE agent_id = $1 AND status IN ('active', 'human_takeover')`, [agentId]);
    if (parseInt(activeConvs.rows[0]?.count ?? '0', 10) > 0) {
        throw new errorHandler_1.AppError(409, 'Cannot delete agent with active conversations', 'AGENT_HAS_ACTIVE_CONVERSATIONS');
    }
    await (0, database_1.query)('DELETE FROM agents WHERE id = $1 AND organization_id = $2', [agentId, orgId]);
}
async function publishAgent(orgId, agentId, userId) {
    const agentResult = await (0, database_1.query)('SELECT * FROM agents WHERE id = $1 AND organization_id = $2', [agentId, orgId]);
    const agent = agentResult.rows[0];
    if (!agent)
        throw new errorHandler_1.AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
    // Day 21: block publish when required config variables are empty. The
    // frontend turns this into a modal pointing the user to the Configuration
    // tab. The check happens BEFORE creating the version snapshot.
    const missingKeys = await getMissingRequiredConfig(orgId, agentId);
    if (missingKeys.length > 0) {
        throw new errorHandler_1.AppError(400, 'Required configuration variables are missing', 'config_variables_required_missing', { missing_keys: missingKeys });
    }
    const versionResult = await (0, database_1.query)('SELECT MAX(version) as max_version FROM agent_versions WHERE agent_id = $1', [agentId]);
    const nextVersion = (versionResult.rows[0]?.max_version ?? 0) + 1;
    const toolsResult = await (0, database_1.query)('SELECT * FROM agent_tools WHERE agent_id = $1', [agentId]);
    const client = await (0, database_1.getClient)();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO agent_versions (
        agent_id, version, system_prompt, llm_provider, llm_model,
        temperature, max_tokens, context_window_messages, variables, tools,
        published_by, published_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`, [
            agentId,
            nextVersion,
            agent.system_prompt,
            agent.llm_provider,
            agent.llm_model,
            agent.temperature,
            agent.max_tokens,
            agent.context_window_messages,
            JSON.stringify(agent.variables ?? []),
            JSON.stringify(toolsResult.rows),
            userId,
        ]);
        const updated = await client.query(`UPDATE agents SET status = 'active', published_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`, [agentId]);
        await client.query('COMMIT');
        return { agent: formatAgent(updated.rows[0]), version: nextVersion };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
async function getVersions(orgId, agentId) {
    await verifyAgentOwnership(orgId, agentId);
    const result = await (0, database_1.query)(`SELECT av.*, u.name as publisher_name
     FROM agent_versions av
     LEFT JOIN users u ON av.published_by = u.id
     WHERE av.agent_id = $1
     ORDER BY av.version DESC`, [agentId]);
    return result.rows;
}
async function rollbackAgent(orgId, agentId, versionId) {
    await verifyAgentOwnership(orgId, agentId);
    const versionResult = await (0, database_1.query)('SELECT * FROM agent_versions WHERE id = $1 AND agent_id = $2', [versionId, agentId]);
    const version = versionResult.rows[0];
    if (!version)
        throw new errorHandler_1.AppError(404, 'Version not found', 'VERSION_NOT_FOUND');
    const result = await (0, database_1.query)(`UPDATE agents SET
      system_prompt = $1, llm_provider = $2, llm_model = $3,
      temperature = $4, max_tokens = $5, context_window_messages = $6,
      variables = $7, updated_at = NOW()
     WHERE id = $8 AND organization_id = $9
     RETURNING *`, [
        version.system_prompt,
        version.llm_provider,
        version.llm_model,
        version.temperature,
        version.max_tokens,
        version.context_window_messages,
        JSON.stringify(version.variables ?? []),
        agentId,
        orgId,
    ]);
    return formatAgent(result.rows[0]);
}
async function getTemplates() {
    const result = await (0, database_1.query)('SELECT * FROM agent_templates WHERE is_active = true ORDER BY category, name', []);
    return result.rows;
}
async function createFromTemplate(orgId, plan, templateId) {
    const templateResult = await (0, database_1.query)('SELECT * FROM agent_templates WHERE id = $1 AND is_active = true', [templateId]);
    const template = templateResult.rows[0];
    if (!template)
        throw new errorHandler_1.AppError(404, 'Template not found', 'TEMPLATE_NOT_FOUND');
    // Build the agent via createAgent first, then back-fill template_id and
    // initial config values from the template's schema defaults so the editor
    // shows defaults pre-populated.
    const agent = await createAgent(orgId, plan, {
        name: template.name,
        description: template.description ?? undefined,
        systemPrompt: template.system_prompt,
        llmProvider: 'openai',
        llmModel: 'gpt-4o-mini',
        variables: template.variables,
    });
    const templateSchema = Array.isArray(template.config_variables_schema)
        ? template.config_variables_schema
        : [];
    const initialValues = (0, shared_1.initialConfigVariableValues)(templateSchema);
    const updated = await (0, database_1.query)(`UPDATE agents
     SET template_id = $1,
         config_variables_values = $2::jsonb,
         updated_at = NOW()
     WHERE id = $3 AND organization_id = $4
     RETURNING *`, [template.id, JSON.stringify(initialValues), agent.id, orgId]);
    return updated.rows[0] ? formatAgent(updated.rows[0]) : agent;
}
async function loadAgentConfigForAgent(orgId, agentId) {
    const agentRes = await (0, database_1.query)(`SELECT template_id, config_variables_values, config_variables_schema_overrides
     FROM agents WHERE id = $1 AND organization_id = $2`, [agentId, orgId]);
    const agent = agentRes.rows[0];
    if (!agent)
        throw new errorHandler_1.AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
    let templateSchema = [];
    if (agent.template_id) {
        const tplRes = await (0, database_1.query)('SELECT config_variables_schema FROM agent_templates WHERE id = $1', [agent.template_id]);
        const raw = tplRes.rows[0]?.config_variables_schema;
        if (Array.isArray(raw))
            templateSchema = raw;
    }
    const overrides = Array.isArray(agent.config_variables_schema_overrides)
        ? agent.config_variables_schema_overrides
        : [];
    const effectiveSchema = (0, shared_1.mergeConfigVariablesSchema)(templateSchema, overrides);
    const values = agent.config_variables_values && typeof agent.config_variables_values === 'object'
        ? agent.config_variables_values
        : {};
    return { agent, templateSchema, overrides, effectiveSchema, values };
}
async function getConfigSchema(orgId, agentId) {
    const { effectiveSchema, values, agent } = await loadAgentConfigForAgent(orgId, agentId);
    return {
        schema: effectiveSchema,
        values,
        templateId: agent.template_id,
    };
}
/**
 * Partial update: merges the new values into the existing JSONB column so
 * unmodified keys are preserved. Validates each provided key against the
 * effective schema; rejects unknown keys.
 */
async function patchConfigValues(orgId, agentId, newValues) {
    if (!newValues || typeof newValues !== 'object') {
        throw new errorHandler_1.AppError(400, 'values must be an object', 'INVALID_INPUT');
    }
    const { effectiveSchema } = await loadAgentConfigForAgent(orgId, agentId);
    const schemaByKey = new Map(effectiveSchema.map((s) => [s.key, s]));
    const errors = {};
    const sanitized = {};
    for (const [key, raw] of Object.entries(newValues)) {
        const schema = schemaByKey.get(key);
        if (!schema) {
            errors[key] = 'errors.configVariables.unknownVariable';
            continue;
        }
        // Coerce common cases: number strings → number; empty → null.
        let value = raw;
        if (value === undefined)
            value = null;
        if (schema.type === 'number' && typeof value === 'string' && value !== '') {
            const n = Number(value);
            if (!Number.isNaN(n))
                value = n;
        }
        if (schema.type === 'boolean' && typeof value === 'string') {
            if (value === 'true')
                value = true;
            else if (value === 'false')
                value = false;
        }
        // Use shared validator
        const { validateConfigVariableValue } = await Promise.resolve().then(() => __importStar(require('@gensmart/shared')));
        const err = validateConfigVariableValue(schema, value);
        if (err) {
            errors[key] = err;
            continue;
        }
        sanitized[key] = value;
    }
    if (Object.keys(errors).length > 0) {
        throw new errorHandler_1.AppError(400, 'Validation failed', 'CONFIG_VARIABLES_INVALID', { errors });
    }
    const result = await (0, database_1.query)(`UPDATE agents
     SET config_variables_values = config_variables_values || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2 AND organization_id = $3
     RETURNING config_variables_values`, [JSON.stringify(sanitized), agentId, orgId]);
    const merged = result.rows[0]?.config_variables_values && typeof result.rows[0].config_variables_values === 'object'
        ? result.rows[0].config_variables_values
        : {};
    return { values: merged };
}
async function replaceConfigOverrides(orgId, agentId, overrides) {
    if (!Array.isArray(overrides)) {
        throw new errorHandler_1.AppError(400, 'overrides must be an array', 'INVALID_INPUT');
    }
    // Validate schema entries + de-dup keys within the overrides array
    const seen = new Set();
    const errors = {};
    const validated = [];
    for (const entry of overrides) {
        const err = (0, shared_1.validateConfigVariableSchema)(entry);
        if (err) {
            const key = entry?.key ?? `__index_${validated.length}`;
            errors[key] = err;
            continue;
        }
        const e = entry;
        if (seen.has(e.key)) {
            errors[e.key] = 'errors.configVariables.duplicateKey';
            continue;
        }
        seen.add(e.key);
        validated.push(e);
    }
    if (Object.keys(errors).length > 0) {
        throw new errorHandler_1.AppError(400, 'Override schema invalid', 'CONFIG_OVERRIDES_INVALID', { errors });
    }
    // Compute the new effective schema BEFORE writing so we can filter out
    // values whose keys no longer exist. Without this step, deleting an override
    // leaves its value behind in config_variables_values as a ghost — invisible
    // in UI, persisted in DB, unreachable.
    const beforeCtx = await loadAgentConfigForAgent(orgId, agentId);
    const newEffective = (0, shared_1.mergeConfigVariablesSchema)(beforeCtx.templateSchema, validated);
    const validKeys = new Set(newEffective.map((s) => s.key));
    const cleanedValues = {};
    for (const [k, v] of Object.entries(beforeCtx.values)) {
        if (validKeys.has(k))
            cleanedValues[k] = v;
    }
    // Single atomic UPDATE keeps schema and values consistent — no window where
    // a concurrent worker could read the new schema with stale orphan values.
    const result = await (0, database_1.query)(`UPDATE agents
     SET config_variables_schema_overrides = $1::jsonb,
         config_variables_values = $2::jsonb,
         updated_at = NOW()
     WHERE id = $3 AND organization_id = $4
     RETURNING config_variables_values`, [JSON.stringify(validated), JSON.stringify(cleanedValues), agentId, orgId]);
    const finalValues = result.rows[0]?.config_variables_values &&
        typeof result.rows[0].config_variables_values === 'object'
        ? result.rows[0].config_variables_values
        : {};
    return { overrides: validated, schema: newEffective, values: finalValues };
}
async function getMissingRequiredConfig(orgId, agentId) {
    const { effectiveSchema, values } = await loadAgentConfigForAgent(orgId, agentId);
    return (0, shared_1.findMissingRequiredConfigVariables)(effectiveSchema, values);
}
// ── Agent Tools ──────────────────────────────────────────────────────────────
async function getTools(orgId, agentId) {
    await verifyAgentOwnership(orgId, agentId);
    const result = await (0, database_1.query)('SELECT * FROM agent_tools WHERE agent_id = $1 ORDER BY created_at ASC', [agentId]);
    return result.rows.map(formatTool);
}
async function createTool(orgId, agentId, data) {
    await verifyAgentOwnership(orgId, agentId);
    const result = await (0, database_1.query)(`INSERT INTO agent_tools (agent_id, type, name, description, config, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`, [agentId, data.type, data.name, data.description ?? null, JSON.stringify(data.config)]);
    return formatTool(result.rows[0]);
}
async function updateTool(orgId, agentId, toolId, data) {
    await verifyAgentOwnership(orgId, agentId);
    const setClauses = [];
    const params = [];
    if (data.name !== undefined) {
        params.push(data.name);
        setClauses.push(`name = $${params.length}`);
    }
    if (data.description !== undefined) {
        params.push(data.description);
        setClauses.push(`description = $${params.length}`);
    }
    if (data.config !== undefined) {
        params.push(JSON.stringify(data.config));
        setClauses.push(`config = $${params.length}`);
    }
    if (data.isEnabled !== undefined) {
        params.push(data.isEnabled);
        setClauses.push(`is_enabled = $${params.length}`);
    }
    if (setClauses.length === 0) {
        const existing = await (0, database_1.query)('SELECT * FROM agent_tools WHERE id = $1', [toolId]);
        return existing.rows[0] ? formatTool(existing.rows[0]) : undefined;
    }
    params.push(toolId, agentId);
    const result = await (0, database_1.query)(`UPDATE agent_tools SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND agent_id = $${params.length}
     RETURNING *`, params);
    return formatTool(result.rows[0]);
}
async function deleteTool(orgId, agentId, toolId) {
    await verifyAgentOwnership(orgId, agentId);
    await (0, database_1.query)('DELETE FROM agent_tools WHERE id = $1 AND agent_id = $2', [toolId, agentId]);
}
async function duplicateAgent(orgId, agentId, plan) {
    const source = await getAgentById(orgId, agentId);
    const newAgent = await createAgent(orgId, plan, {
        name: `Copy of ${source.name}`,
        description: source.description ?? undefined,
        systemPrompt: source.systemPrompt,
        llmProvider: source.llmProvider,
        llmModel: source.llmModel,
        temperature: source.temperature,
        maxTokens: source.maxTokens,
        contextWindowMessages: source.contextWindowMessages,
        channels: source.channels,
        messageBufferSeconds: source.messageBufferSeconds,
        variables: source.variables,
    });
    // Copy tools from source agent (source.tools is already formatted with camelCase)
    for (const tool of source.tools) {
        await (0, database_1.query)(`INSERT INTO agent_tools (agent_id, type, name, description, config, is_enabled, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`, [newAgent.id, tool.type, tool.name, tool.description, JSON.stringify(tool.config), tool.isEnabled]);
    }
    return newAgent;
}
// ── Helpers ──────────────────────────────────────────────────────────────────
async function verifyAgentOwnership(orgId, agentId) {
    const result = await (0, database_1.query)('SELECT id FROM agents WHERE id = $1 AND organization_id = $2', [agentId, orgId]);
    if (!result.rows[0])
        throw new errorHandler_1.AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
}
// ── Plan enforcement for tools ────────────────────────────────────────────────
async function countToolsByType(agentId, type) {
    const result = await (0, database_1.query)('SELECT COUNT(*) as count FROM agent_tools WHERE agent_id = $1 AND type = $2', [agentId, type]);
    return parseInt(result.rows[0]?.count ?? '0', 10);
}
function formatKnowledgeFile(row) {
    return {
        id: row.id,
        agentId: row.agent_id,
        filename: row.filename,
        fileType: row.file_type,
        sourceUrl: row.source_url,
        fileSize: row.file_size,
        status: row.status,
        errorMessage: row.error_message,
        chunkCount: row.chunk_count,
        lastProcessedAt: row.last_processed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
async function getKnowledgeFiles(orgId, agentId) {
    await verifyAgentOwnership(orgId, agentId);
    const result = await (0, database_1.query)('SELECT * FROM knowledge_files WHERE agent_id = $1 ORDER BY created_at DESC', [agentId]);
    return result.rows.map(formatKnowledgeFile);
}
async function createKnowledgeFile(orgId, agentId, data) {
    await verifyAgentOwnership(orgId, agentId);
    const result = await (0, database_1.query)(`INSERT INTO knowledge_files (agent_id, filename, file_type, file_path, file_size, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'processing',NOW(),NOW()) RETURNING *`, [agentId, data.filename, data.fileType, data.filePath ?? null, data.fileSize ?? null]);
    return formatKnowledgeFile(result.rows[0]);
}
async function createKnowledgeFileFromUrl(orgId, agentId, url) {
    await verifyAgentOwnership(orgId, agentId);
    // Extract filename from URL
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split('/').pop() ?? 'web-page';
    const result = await (0, database_1.query)(`INSERT INTO knowledge_files (agent_id, filename, file_type, source_url, status, created_at, updated_at)
     VALUES ($1,$2,'web',$3,'processing',NOW(),NOW()) RETURNING *`, [agentId, filename || url, url]);
    return formatKnowledgeFile(result.rows[0]);
}
async function reprocessKnowledgeFile(orgId, agentId, fileId) {
    await verifyAgentOwnership(orgId, agentId);
    const result = await (0, database_1.query)(`UPDATE knowledge_files SET status = 'processing', error_message = NULL, updated_at = NOW()
     WHERE id = $1 AND agent_id = $2 RETURNING *`, [fileId, agentId]);
    if (!result.rows[0])
        throw new errorHandler_1.AppError(404, 'Knowledge file not found', 'FILE_NOT_FOUND');
    return formatKnowledgeFile(result.rows[0]);
}
async function deleteKnowledgeFile(orgId, agentId, fileId) {
    await verifyAgentOwnership(orgId, agentId);
    await (0, database_1.query)('DELETE FROM knowledge_files WHERE id = $1 AND agent_id = $2', [fileId, agentId]);
}
// ── Preview agent ─────────────────────────────────────────────────────────────
async function previewAgent(orgId, agentId, message, history, draftSystemPrompt) {
    const agentResult = await (0, database_1.query)('SELECT * FROM agents WHERE id = $1 AND organization_id = $2', [agentId, orgId]);
    const agent = agentResult.rows[0];
    if (!agent)
        throw new errorHandler_1.AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
    const { chat } = await Promise.resolve().then(() => __importStar(require('./llm.service')));
    const systemPrompt = draftSystemPrompt ?? agent.system_prompt;
    const messages = [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
    ];
    const response = await chat({
        provider: agent.llm_provider,
        model: agent.llm_model,
        system: systemPrompt,
        messages,
        temperature: parseFloat(agent.temperature),
        maxTokens: Math.min(agent.max_tokens, 512), // limit preview to 512 tokens
    });
    return { message: response.content };
}
// ── Test tool ─────────────────────────────────────────────────────────────────
async function testTool(orgId, agentId, toolId, params) {
    await verifyAgentOwnership(orgId, agentId);
    const toolResult = await (0, database_1.query)('SELECT * FROM agent_tools WHERE id = $1 AND agent_id = $2', [toolId, agentId]);
    const tool = toolResult.rows[0];
    if (!tool)
        throw new errorHandler_1.AppError(404, 'Tool not found', 'TOOL_NOT_FOUND');
    if (tool.type !== 'custom_function') {
        throw new errorHandler_1.AppError(400, 'Only custom functions can be tested', 'INVALID_TOOL_TYPE');
    }
    const cfg = tool.config;
    const endpointUrl = cfg['endpointUrl'];
    const httpMethod = cfg['httpMethod'] ?? 'POST';
    const headers = cfg['headers'] ?? {};
    const auth = cfg['auth'];
    const bodyTemplate = cfg['bodyTemplate'];
    const timeoutMs = cfg['timeoutMs'] ?? 10000;
    if (!endpointUrl)
        throw new errorHandler_1.AppError(400, 'Tool has no endpoint URL configured', 'MISSING_CONFIG');
    // Build headers
    const requestHeaders = { 'Content-Type': 'application/json', ...headers };
    if (auth?.type === 'bearer' && auth.token) {
        requestHeaders['Authorization'] = `Bearer ${auth.token}`;
    }
    else if (auth?.type === 'api_key_header' && auth.headerName && auth.apiKey) {
        requestHeaders[auth.headerName] = auth.apiKey;
    }
    // Build URL (add query params for API key query type)
    let url = endpointUrl;
    if (auth?.type === 'api_key_query' && auth.queryParam && auth.apiKey) {
        const u = new URL(url);
        u.searchParams.set(auth.queryParam, auth.apiKey);
        url = u.toString();
    }
    // Build body: substitute params into body template or use params directly
    let body = params;
    if (bodyTemplate) {
        const bodyStr = JSON.stringify(bodyTemplate).replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ''));
        try {
            body = JSON.parse(bodyStr);
        }
        catch {
            body = params;
        }
    }
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: httpMethod,
            headers: requestHeaders,
            body: httpMethod !== 'GET' ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        let responseData;
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            responseData = await res.json();
        }
        else {
            responseData = await res.text();
        }
        return { status: res.status, latencyMs, data: responseData };
    }
    catch (err) {
        clearTimeout(timeout);
        const e = err;
        if (e.name === 'AbortError') {
            throw new errorHandler_1.AppError(408, `Request timed out after ${timeoutMs}ms`, 'TIMEOUT');
        }
        throw new errorHandler_1.AppError(502, e.message ?? 'Request failed', 'REQUEST_FAILED');
    }
}
//# sourceMappingURL=agent.service.js.map