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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const orgContext_1 = require("../middleware/orgContext");
const validate_1 = require("../middleware/validate");
const validateUUID_1 = require("../middleware/validateUUID");
const planLimits_1 = require("../middleware/planLimits");
const agentService = __importStar(require("../services/agent.service"));
const shared_1 = require("@gensmart/shared");
const queues_1 = require("../config/queues");
const database_1 = require("../config/database");
const mcp_client_service_1 = require("../services/mcp-client.service");
const mcp_headers_service_1 = require("../services/mcp-headers.service");
const mcpProviders = __importStar(require("../services/mcp-providers.service"));
const encryption_1 = require("../config/encryption");
const send_email_notification_service_1 = require("../services/send-email-notification.service");
const redis_1 = require("../config/redis");
const text_1 = require("../utils/text");
const crypto_1 = require("crypto");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, orgContext_1.orgContext);
// ── Multer setup ──────────────────────────────────────────────────────────────
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const avatarStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path_1.default.join(uploadsDir, 'avatars');
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
});
const knowledgeStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path_1.default.join(uploadsDir, 'knowledge');
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
});
const uploadAvatar = (0, multer_1.default)({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new Error('Only image files are allowed'));
        }
        else {
            cb(null, true);
        }
    },
});
const uploadKnowledge = (0, multer_1.default)({
    storage: knowledgeStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.txt', '.md'];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
            cb(new Error('Only PDF, DOCX, TXT, MD files are allowed'));
        }
        else {
            cb(null, true);
        }
    },
});
// ── Schemas ───────────────────────────────────────────────────────────────────
const toolSchema = zod_1.z.object({
    type: zod_1.z.enum(['scheduling', 'rag', 'custom_function', 'mcp', 'email_notification']),
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional(),
    config: zod_1.z.record(zod_1.z.unknown()),
});
const toolUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(1000).optional(),
    config: zod_1.z.record(zod_1.z.unknown()).optional(),
    isEnabled: zod_1.z.boolean().optional(),
});
// MCP-specific schema. Validated only when type === 'mcp'; toolSchema keeps
// `config` as a free record so other tool types (custom_function etc.) are
// unaffected. See docs/INTEGRATION.md §3.
const mcpHeaderInputSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).max(100).regex(/^[A-Za-z0-9-]+$/, 'Invalid header name'),
    value: zod_1.z.string().max(2000),
});
const mcpConfigInputSchema = zod_1.z.object({
    server_url: zod_1.z.string().url(),
    name: zod_1.z.string().min(1).max(100).optional().default('mcp'),
    transport: zod_1.z.enum(['sse', 'streamable-http']).optional().default('sse'),
    selected_tools: zod_1.z.array(zod_1.z.string()).optional().default([]),
    headers: zod_1.z.array(mcpHeaderInputSchema).max(20).optional().default([]),
    providerId: zod_1.z.string().min(1).max(50).optional(),
});
/**
 * Validate that all required user_configurable_headers from a profile are
 * present (and meet min_length) in the supplied headers array. Throws an
 * Error with message "<headerKey>: <reason>" suitable for HTTP 400.
 *
 * Two values bypass the min_length check:
 *   - ''                            → empty signals "delete this header" (B1)
 *   - MCP_HEADER_PRESERVE_PLACEHOLDER → "do not touch existing ciphertext"
 * Either way the user is not submitting a new plaintext value, so length
 * rules don't apply.
 */
function validateProviderHeaders(profile, headers) {
    const headerMap = new Map();
    for (const h of headers) {
        if (h?.key)
            headerMap.set(h.key, h.value ?? '');
    }
    for (const required of profile.user_configurable_headers) {
        if (!required.required)
            continue;
        const value = headerMap.get(required.key);
        if (value === undefined) {
            throw new Error(`Missing required header for ${profile.name}: ${required.key}`);
        }
        if (value !== '' &&
            value !== mcp_headers_service_1.MCP_HEADER_PRESERVE_PLACEHOLDER &&
            required.min_length &&
            value.length < required.min_length) {
            throw new Error(`Header ${required.key} must be at least ${required.min_length} characters`);
        }
    }
}
// GET /api/agents/templates — must be before /:id routes
router.get('/templates', async (_req, res, next) => {
    try {
        const templates = await agentService.getTemplates();
        res.json({ templates });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/generate-prompt
router.post('/generate-prompt', async (req, res, next) => {
    try {
        const { description, language = 'en' } = req.body;
        if (!description || String(description).trim().length < 10) {
            res.status(400).json({
                error: { message: 'Description must be at least 10 characters', code: 'INVALID_INPUT' },
            });
            return;
        }
        const { generatePrompt } = await Promise.resolve().then(() => __importStar(require('../services/llm.service')));
        const result = await generatePrompt(String(description).trim(), String(language));
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/from-template/:templateId — must be before /:id routes
router.post('/from-template/:templateId', async (req, res, next) => {
    try {
        const agent = await agentService.createFromTemplate(req.org.id, req.org.plan, String(req.params['templateId']));
        res.status(201).json({ agent });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/agents
router.get('/', async (req, res, next) => {
    try {
        const { search, status, channel, page, limit } = req.query;
        const result = await agentService.getAgents(req.org.id, {
            search,
            status,
            channel,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents
router.post('/', (0, planLimits_1.checkAgentLimit)(), (0, validate_1.validate)(shared_1.agentCreateSchema), async (req, res, next) => {
    try {
        const agent = await agentService.createAgent(req.org.id, req.org.plan, req.body);
        res.status(201).json({ agent });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/agents/:id/tools
router.get('/:id/tools', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const tools = await agentService.getTools(req.org.id, String(req.params['id']));
        res.json({ tools });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/tools — with plan enforcement
router.post('/:id/tools', (0, validateUUID_1.validateUUID)('id'), (0, validate_1.validate)(toolSchema), async (req, res, next) => {
    try {
        const agentId = String(req.params['id']);
        const plan = req.org.plan;
        const planLimits = shared_1.PLAN_LIMITS[plan];
        const toolType = req.body.type;
        // Enforce plan limits for custom_function
        if (toolType === 'custom_function') {
            const limit = planLimits?.customFunctions ?? 0;
            if (limit === 0) {
                res.status(403).json({
                    error: { message: 'Custom functions are not available in your plan. Upgrade to Starter or above.', code: 'PLAN_LIMIT_REACHED' },
                });
                return;
            }
            if (limit !== Infinity) {
                const currentCount = await agentService.countToolsByType(agentId, 'custom_function');
                if (currentCount >= limit) {
                    res.status(403).json({
                        error: { message: `Custom function limit reached (${limit}). Upgrade your plan to add more.`, code: 'PLAN_LIMIT_REACHED' },
                    });
                    return;
                }
            }
        }
        // Enforce plan limits for mcp
        if (toolType === 'mcp') {
            const limit = planLimits?.mcpServers ?? 0;
            if (limit === 0) {
                res.status(403).json({
                    error: { message: 'MCP servers are not available in your plan. Upgrade to Pro or above.', code: 'PLAN_LIMIT_REACHED' },
                });
                return;
            }
            if (limit !== Infinity) {
                const currentCount = await agentService.countToolsByType(agentId, 'mcp');
                if (currentCount >= limit) {
                    res.status(403).json({
                        error: { message: `MCP server limit reached (${limit}). Upgrade your plan to add more.`, code: 'PLAN_LIMIT_REACHED' },
                    });
                    return;
                }
            }
        }
        // Enforce plan limits for email_notification
        if (toolType === 'email_notification') {
            const limit = planLimits['emailNotificationTools'] ?? 0;
            if (limit === 0) {
                res.status(403).json({
                    error: {
                        message: 'Email notification tools are not available in your plan. Upgrade to Starter or above.',
                        code: 'PLAN_LIMIT_REACHED',
                    },
                });
                return;
            }
            if (limit !== Infinity) {
                const currentCount = await agentService.countToolsByType(agentId, 'email_notification');
                if (currentCount >= limit) {
                    res.status(403).json({
                        error: {
                            message: `Email notification tool limit reached (${limit}). Upgrade your plan to add more.`,
                            code: 'PLAN_LIMIT_REACHED',
                        },
                    });
                    return;
                }
            }
        }
        // For MCP tools: encrypt user-supplied headers and auto-generate the
        // webhook secret. The plain secret is returned ONCE so the frontend can
        // show it for copy; subsequent reads must use /regenerate-webhook-secret.
        let plainWebhookSecret = null;
        if (toolType === 'mcp') {
            const validated = mcpConfigInputSchema.parse(req.body.config ?? {});
            // If providerId is supplied: resolve profile, validate required user
            // headers. auto_injected_headers are NOT persisted — they are resolved
            // every time from platform_settings at runtime so master keys can be
            // rotated centrally.
            if (validated.providerId) {
                const profile = await mcpProviders.findProfileById(validated.providerId);
                if (!profile || !profile.is_active) {
                    res.status(400).json({
                        error: { message: `Unknown or inactive MCP provider: ${validated.providerId}`, code: 'INVALID_PROVIDER' },
                    });
                    return;
                }
                try {
                    validateProviderHeaders(profile, validated.headers);
                }
                catch (err) {
                    res.status(400).json({ error: { message: err.message, code: 'INVALID_PROVIDER_HEADERS' } });
                    return;
                }
            }
            plainWebhookSecret = (0, mcp_headers_service_1.generateWebhookSecret)();
            req.body.config = {
                server_url: validated.server_url,
                name: validated.name,
                transport: validated.transport,
                selected_tools: validated.selected_tools,
                headers: (0, mcp_headers_service_1.encryptHeaders)(validated.headers),
                webhookSecret_encrypted: (0, encryption_1.encrypt)(plainWebhookSecret),
                ...(validated.providerId ? { providerId: validated.providerId } : {}),
            };
        }
        const tool = await agentService.createTool(req.org.id, agentId, req.body);
        if (plainWebhookSecret) {
            res.status(201).json({ tool, webhookSecret: plainWebhookSecret });
        }
        else {
            res.status(201).json({ tool });
        }
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/tools/mcp/test-connection — must be before /:id/tools/:toolId
router.post('/:id/tools/mcp/test-connection', (0, validateUUID_1.validateUUID)('id'), async (req, res) => {
    try {
        const { server_url, transport, headers: rawHeaders, providerId, toolId } = req.body;
        if (!server_url || typeof server_url !== 'string') {
            res.status(400).json({ success: false, error: 'server_url is required' });
            return;
        }
        const mcpTransport = (transport === 'streamable-http' ? 'streamable-http' : 'sse');
        // Validate URL
        let parsed;
        try {
            parsed = new URL(server_url);
        }
        catch {
            res.status(400).json({ success: false, error: 'Invalid URL format' });
            return;
        }
        // Require HTTPS (allow http://localhost for dev)
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (parsed.protocol !== 'https:' && !isLocal) {
            res.status(400).json({ success: false, error: 'Server URL must use HTTPS' });
            return;
        }
        // When editing an existing tool, pre-load its persisted (encrypted)
        // headers so we can resolve any sentinel-valued entries back to their
        // real plaintext. Ownership-scoped by (toolId, agentId).
        let savedDecryptedHeaders = {};
        if (toolId && /^[0-9a-f-]{36}$/i.test(toolId)) {
            try {
                const existing = await (0, database_1.query)('SELECT config FROM agent_tools WHERE id = $1 AND agent_id = $2', [toolId, String(req.params['id'])]);
                const cfg = existing.rows[0]?.config;
                if (cfg?.headers) {
                    savedDecryptedHeaders = (0, mcp_headers_service_1.decryptHeaders)(cfg.headers);
                }
            }
            catch (err) {
                console.warn('[agents] test-connection: failed to load saved headers for sentinel resolution:', err.message);
            }
        }
        // Test-time headers come from the form. For each entry:
        //   - empty value          → user intends to delete; skip
        //   - sentinel placeholder → resolve from saved ciphertext if available;
        //                            otherwise skip (treat as "nothing to test")
        //   - plain value          → use as-is
        const userExtraHeaders = {};
        if (Array.isArray(rawHeaders)) {
            for (const h of rawHeaders) {
                const k = h?.key?.trim();
                const v = h?.value;
                if (!k || typeof v !== 'string')
                    continue;
                if (v.length === 0)
                    continue;
                if (v === mcp_headers_service_1.MCP_HEADER_PRESERVE_PLACEHOLDER) {
                    const saved = savedDecryptedHeaders[k];
                    if (saved && saved.length > 0) {
                        userExtraHeaders[k] = saved;
                    }
                    // else: cannot resolve — skip rather than send the sentinel literal.
                    continue;
                }
                userExtraHeaders[k] = v;
            }
        }
        // Resolve provider auto-injected headers BEFORE handing off to the
        // agnostic MCP client. Same merge order as worker/preview: profile
        // platform headers first, user headers may override.
        let profile = null;
        let profileAutoHeaders = {};
        if (providerId) {
            profile = await mcpProviders.findProfileById(providerId);
            if (profile && profile.is_active) {
                profileAutoHeaders = await mcpProviders.resolveAutoHeaders(profile);
            }
            else {
                profile = null;
            }
        }
        // System auto-headers — required by tenant-aware MCPs (e.g. Mastershop).
        // Test isn't tied to a real conversation/tool, so we use a fresh session
        // UUID and an ephemeral webhook secret. Real secrets are persisted only
        // on tool creation. System headers always win the merge.
        const systemAutoHeaders = {
            'X-Agent-ID': String(req.params['id']),
            'X-Session-ID': (0, crypto_1.randomUUID)(),
            'X-Webhook-Secret': (0, mcp_headers_service_1.generateWebhookSecret)(),
        };
        const extraHeaders = {
            ...profileAutoHeaders,
            ...userExtraHeaders,
            ...systemAutoHeaders,
        };
        // Step 1: MCP handshake (tools/list). A failure here means we couldn't
        // even reach the MCP — return a handshake-specific error.
        let tools;
        try {
            tools = await (0, mcp_client_service_1.connectAndListTools)(server_url, mcpTransport, extraHeaders);
        }
        catch (err) {
            const message = err.message;
            console.error('[agents] MCP test-connection handshake failed:', message);
            res.json({ success: false, error: message, errorCode: 'HANDSHAKE_FAILED' });
            return;
        }
        // Step 2: If the profile defines a health-check tool, run it to validate
        // credentials end-to-end. Handshake alone passes even for revoked keys.
        if (profile && profile.health_check_tool) {
            const hc = profile.health_check_tool;
            // The selected/available tool name on the server may be prefixed
            // (mcp_<server>_<tool>) when invoked via the worker; the raw MCP tool
            // name comes back unprefixed from tools/list. Use the unprefixed name.
            const matchingTool = tools.find((t) => t.name === hc.name);
            if (!matchingTool) {
                // The provider profile claims a health-check tool that the server
                // doesn't expose — log + fall through to handshake_only rather than
                // alarm the user (server may have evolved).
                console.warn(`[agents] Profile ${profile.id} health_check_tool "${hc.name}" not in server tool list`);
                res.json({
                    success: true,
                    tools,
                    mode: 'handshake_only',
                    providerName: profile.name,
                });
                return;
            }
            try {
                const result = await (0, mcp_client_service_1.executeMCPTool)(server_url, hc.name, hc.params, mcpTransport, extraHeaders);
                if (result.isError) {
                    console.error(`[agents] MCP test-connection health-check tool "${hc.name}" returned error:`, result.content);
                    res.json({
                        success: false,
                        errorCode: 'AUTH_FAILED',
                        error: result.content,
                        providerName: profile.name,
                    });
                    return;
                }
                res.json({
                    success: true,
                    tools,
                    mode: 'full_auth',
                    toolUsed: hc.name,
                    providerName: profile.name,
                });
                return;
            }
            catch (err) {
                const message = err.message;
                console.error('[agents] MCP test-connection health-check threw:', message);
                res.json({
                    success: false,
                    errorCode: 'AUTH_FAILED',
                    error: message,
                    providerName: profile.name,
                });
                return;
            }
        }
        // Step 3: No profile or profile without health-check → handshake-only.
        res.json({
            success: true,
            tools,
            mode: 'handshake_only',
            ...(profile ? { providerName: profile.name } : {}),
        });
    }
    catch (err) {
        const message = err.message;
        console.error('[agents] MCP test-connection failed:', message);
        res.json({ success: false, error: message, errorCode: 'HANDSHAKE_FAILED' });
    }
});
// GET /api/agents/:id/tools/mcp/providers — list active provider profiles
// (sensitive fields stripped). Used by MCPConfigurator empty-state catalog.
router.get('/:id/tools/mcp/providers', (0, validateUUID_1.validateUUID)('id'), async (_req, res, next) => {
    try {
        const profiles = await mcpProviders.listActiveProfiles();
        res.json({ providers: profiles.map(mcpProviders.toPublicProfile) });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/agents/:id/tools/mcp/resolve-profile?url=...
// Returns the matching provider profile for a pasted URL (or { profile: null }).
router.get('/:id/tools/mcp/resolve-profile', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const url = String(req.query['url'] ?? '');
        if (!url || url.length > 500) {
            res.status(400).json({ error: { message: 'Invalid url parameter', code: 'INVALID_URL' } });
            return;
        }
        const profile = await mcpProviders.findProfileByUrl(url);
        res.json({ profile: profile ? mcpProviders.toPublicProfile(profile) : null });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/agents/:id/tools/:toolId
router.put('/:id/tools/:toolId', (0, validateUUID_1.validateUUID)('id', 'toolId'), (0, validate_1.validate)(toolUpdateSchema), async (req, res, next) => {
    try {
        const toolId = String(req.params['toolId']);
        const agentId = String(req.params['id']);
        // For MCP tools with a config update: re-encrypt headers, preserve any
        // header whose plain value is '' (UI sends empty when user didn't re-type
        // an existing encrypted value), and preserve the existing webhook secret.
        if (req.body.config !== undefined) {
            const existingTool = await (0, database_1.query)('SELECT type, config FROM agent_tools WHERE id = $1 AND agent_id = $2', [toolId, agentId]);
            if (existingTool.rows.length > 0 && existingTool.rows[0].type === 'mcp') {
                const existingCfg = existingTool.rows[0].config;
                const validated = mcpConfigInputSchema.parse(req.body.config);
                // Preserve providerId across updates if not explicitly changed.
                const effectiveProviderId = validated.providerId ?? existingCfg.providerId;
                if (effectiveProviderId) {
                    const profile = await mcpProviders.findProfileById(effectiveProviderId);
                    if (!profile || !profile.is_active) {
                        res.status(400).json({
                            error: { message: `Unknown or inactive MCP provider: ${effectiveProviderId}`, code: 'INVALID_PROVIDER' },
                        });
                        return;
                    }
                    try {
                        validateProviderHeaders(profile, validated.headers);
                    }
                    catch (err) {
                        res.status(400).json({ error: { message: err.message, code: 'INVALID_PROVIDER_HEADERS' } });
                        return;
                    }
                }
                // Merge headers — three cases:
                //   1. value === PRESERVE_PLACEHOLDER → keep existing ciphertext
                //      (UI echoes this when the user did not retype an encrypted value).
                //   2. value === ''                   → DELETE this header
                //      (user explicitly cleared the field; B1 hotfix).
                //   3. any other value                → encrypt as new value.
                // Empty-key entries are dropped unconditionally.
                const mergedHeaders = [];
                for (const h of validated.headers) {
                    if (!h.key || h.key.trim().length === 0)
                        continue;
                    if (h.value === mcp_headers_service_1.MCP_HEADER_PRESERVE_PLACEHOLDER) {
                        const prior = existingCfg.headers?.find((eh) => eh.key === h.key);
                        if (prior)
                            mergedHeaders.push(prior);
                        // else: nothing to preserve — drop.
                    }
                    else if (h.value === '') {
                        // Explicit delete — do not push.
                        continue;
                    }
                    else {
                        mergedHeaders.push({ key: h.key, value_encrypted: (0, encryption_1.encrypt)(h.value) });
                    }
                }
                req.body.config = {
                    server_url: validated.server_url,
                    name: validated.name,
                    transport: validated.transport,
                    selected_tools: validated.selected_tools,
                    headers: mergedHeaders,
                    // Preserve secret — rotation is explicit via /regenerate-webhook-secret
                    webhookSecret_encrypted: existingCfg.webhookSecret_encrypted,
                    ...(effectiveProviderId ? { providerId: effectiveProviderId } : {}),
                };
            }
        }
        const tool = await agentService.updateTool(req.org.id, agentId, toolId, req.body);
        // Invalidate MCP tool cache if config changed
        if (tool && tool.type === 'mcp') {
            await redis_1.redis.del(`mcp:tools:${toolId}`).catch(() => { });
        }
        res.json({ tool });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/tools/:toolId/regenerate-webhook-secret
// Rotates the secret used both as outbound X-Webhook-Secret header AND inbound
// HMAC key. Returns plain text ONCE — the dropshipper must update their MCP
// server with the new value or webhooks will fail HMAC verification.
router.post('/:id/tools/:toolId/regenerate-webhook-secret', (0, validateUUID_1.validateUUID)('id', 'toolId'), async (req, res, next) => {
    try {
        const agentId = String(req.params['id']);
        const toolId = String(req.params['toolId']);
        // Verify the agent belongs to the org and the tool is MCP
        const existing = await (0, database_1.query)(`SELECT t.type, t.config, a.organization_id AS agent_org
         FROM agent_tools t
         JOIN agents a ON a.id = t.agent_id
         WHERE t.id = $1 AND t.agent_id = $2`, [toolId, agentId]);
        if (existing.rows.length === 0 || existing.rows[0].agent_org !== req.org.id) {
            res.status(404).json({ error: { message: 'Tool not found', code: 'NOT_FOUND' } });
            return;
        }
        if (existing.rows[0].type !== 'mcp') {
            res.status(400).json({ error: { message: 'Not an MCP tool', code: 'INVALID_TOOL_TYPE' } });
            return;
        }
        const newSecret = (0, mcp_headers_service_1.generateWebhookSecret)();
        const newConfig = {
            ...existing.rows[0].config,
            webhookSecret_encrypted: (0, encryption_1.encrypt)(newSecret),
        };
        await (0, database_1.query)('UPDATE agent_tools SET config = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(newConfig), toolId]);
        // Invalidate MCP tool cache so the worker picks up the new secret on next call
        await redis_1.redis.del(`mcp:tools:${toolId}`).catch(() => { });
        res.json({ webhookSecret: newSecret });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/agents/:id/tools/:toolId
router.delete('/:id/tools/:toolId', (0, validateUUID_1.validateUUID)('id', 'toolId'), async (req, res, next) => {
    try {
        const toolId = String(req.params['toolId']);
        // Invalidate MCP tool cache before deletion
        await redis_1.redis.del(`mcp:tools:${toolId}`).catch(() => { });
        await agentService.deleteTool(req.org.id, String(req.params['id']), toolId);
        res.json({ message: 'Tool deleted successfully' });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/tools/:toolId/test
router.post('/:id/tools/:toolId/test', (0, validateUUID_1.validateUUID)('id', 'toolId'), async (req, res, next) => {
    try {
        const result = await agentService.testTool(req.org.id, String(req.params['id']), String(req.params['toolId']), req.body.params ?? {});
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/tools/:toolId/test-email-notification
router.post('/:id/tools/:toolId/test-email-notification', (0, validateUUID_1.validateUUID)('id', 'toolId'), async (req, res, next) => {
    try {
        const agentId = String(req.params['id']);
        const toolId = String(req.params['toolId']);
        const toolResult = await (0, database_1.query)(`SELECT t.id, t.type, t.name, t.config
         FROM agent_tools t
         JOIN agents a ON a.id = t.agent_id
         WHERE t.id = $1 AND a.id = $2 AND a.organization_id = $3`, [toolId, agentId, req.org.id]);
        const tool = toolResult.rows[0];
        if (!tool || tool.type !== 'email_notification') {
            res.status(404).json({ error: { message: 'Email notification tool not found', code: 'NOT_FOUND' } });
            return;
        }
        const cfg = tool.config;
        if (!cfg.recipientEmail) {
            res.status(400).json({ success: false, message: 'Tool has no recipient email configured' });
            return;
        }
        // Generate dummy values for each parameter
        const dummyArgs = {};
        for (const param of cfg.parameters || []) {
            if (param.type === 'number') {
                dummyArgs[param.name] = 100;
            }
            else if (param.type === 'boolean') {
                dummyArgs[param.name] = true;
            }
            else {
                dummyArgs[param.name] = `[Test value for ${param.name}]`;
            }
        }
        const { emailTemplate: emailTmpl, sendEmail: sendEmailFn } = await Promise.resolve().then(() => __importStar(require('../config/email')));
        const fullHtml = emailTmpl(`
        <h2 style="margin:0 0 16px;color:#1A1A1A;">${cfg.subject} (TEST)</h2>
        <div style="background:#fff3cd;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #f59e0b;">
          <p style="margin:0;color:#92400e;font-size:13px;">
            <strong>This is a test email</strong> sent from the GenSmart dashboard to validate your email notification tool configuration.
            Real notifications will be triggered by your AI agent during conversations.
          </p>
        </div>
        <p style="color:#6B7280;font-size:14px;">Tool name: <strong>${tool.name}</strong></p>
        <p style="color:#6B7280;font-size:14px;">Recipient: <strong>${cfg.recipientEmail}</strong></p>
        <p style="color:#6B7280;font-size:14px;">Dummy parameters: <code>${JSON.stringify(dummyArgs)}</code></p>
      `);
        const fromAddress = cfg.fromName
            ? `${cfg.fromName} <${process.env['SMTP_FROM'] ?? 'noreply@gensmart.co'}>`
            : undefined;
        try {
            await sendEmailFn({
                to: cfg.recipientEmail,
                cc: cfg.ccEmails,
                subject: `[TEST] ${cfg.subject}`,
                html: fullHtml,
                from: fromAddress,
                replyTo: cfg.replyTo,
            });
            res.json({ success: true, message: `Test email sent to ${cfg.recipientEmail}` });
        }
        catch (err) {
            res.json({ success: false, message: `Failed: ${err.message}` });
        }
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/duplicate — must be before /:id routes
router.post('/:id/duplicate', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const agent = await agentService.duplicateAgent(req.org.id, String(req.params['id']), req.org.plan);
        res.status(201).json({ agent });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/avatar
router.post('/:id/avatar', (0, validateUUID_1.validateUUID)('id'), uploadAvatar.single('avatar'), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: { message: 'No file uploaded', code: 'MISSING_FILE' } });
            return;
        }
        const apiBase = process.env['API_BASE_URL'] ?? 'http://localhost:4000';
        const avatarUrl = `${apiBase}/uploads/avatars/${file.filename}`;
        const agent = await agentService.updateAgent(req.org.id, String(req.params['id']), {
            avatarUrl,
        });
        res.json({ avatarUrl: agent.avatarUrl });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/agents/:id/knowledge
router.get('/:id/knowledge', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const files = await agentService.getKnowledgeFiles(req.org.id, String(req.params['id']));
        res.json({ files });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/knowledge (file upload)
router.post('/:id/knowledge', (0, validateUUID_1.validateUUID)('id'), (0, planLimits_1.checkKnowledgeLimit)(), uploadKnowledge.single('file'), async (req, res, next) => {
    try {
        const agentId = String(req.params['id']);
        const plan = req.org.plan;
        const planLimits = shared_1.PLAN_LIMITS[plan];
        const fileLimit = planLimits?.knowledgeFiles ?? 1;
        // Check file limit
        const existingFiles = await agentService.getKnowledgeFiles(req.org.id, agentId);
        if (fileLimit !== Infinity && existingFiles.length >= fileLimit) {
            res.status(403).json({
                error: { message: `File limit reached (${fileLimit}). Upgrade your plan to add more.`, code: 'PLAN_LIMIT_REACHED' },
            });
            return;
        }
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: { message: 'No file uploaded', code: 'MISSING_FILE' } });
            return;
        }
        const ext = path_1.default.extname(file.originalname).toLowerCase().slice(1);
        const knowledgeFile = await agentService.createKnowledgeFile(req.org.id, agentId, {
            filename: file.originalname,
            fileType: ext,
            filePath: file.path,
            fileSize: file.size,
        });
        // Enqueue RAG processing job
        const ragEnqueued = await queues_1.ragQueue.add('process-file', {
            fileId: knowledgeFile.id,
            agentId,
            organizationId: req.org.id,
        }).catch(async (err) => {
            console.error('[agents] Failed to enqueue RAG job:', err);
            await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`, ['Processing queue unavailable. Click reprocess to retry.', knowledgeFile.id]).catch(() => { });
            return null;
        });
        console.log(`[agents] File ${knowledgeFile.id} uploaded, RAG job: ${ragEnqueued ? String(ragEnqueued.id) : 'FAILED'}`);
        res.status(201).json({ file: knowledgeFile });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/knowledge/web
router.post('/:id/knowledge/web', (0, validateUUID_1.validateUUID)('id'), (0, planLimits_1.checkKnowledgeLimit)(), async (req, res, next) => {
    try {
        const agentId = String(req.params['id']);
        const { url } = req.body;
        if (!url) {
            res.status(400).json({ error: { message: 'URL is required', code: 'MISSING_URL' } });
            return;
        }
        // Validate URL
        try {
            new URL(url);
        }
        catch {
            res.status(400).json({ error: { message: 'Invalid URL format', code: 'INVALID_URL' } });
            return;
        }
        const plan = req.org.plan;
        const planLimits = shared_1.PLAN_LIMITS[plan];
        const fileLimit = planLimits?.knowledgeFiles ?? 1;
        const existingFiles = await agentService.getKnowledgeFiles(req.org.id, agentId);
        if (fileLimit !== Infinity && existingFiles.length >= fileLimit) {
            res.status(403).json({
                error: { message: `File limit reached (${fileLimit}). Upgrade your plan to add more.`, code: 'PLAN_LIMIT_REACHED' },
            });
            return;
        }
        const file = await agentService.createKnowledgeFileFromUrl(req.org.id, agentId, url);
        // Enqueue scraping job
        const scrapeEnqueued = await queues_1.scrapingQueue.add('scrape-url', {
            fileId: file.id,
            agentId,
            organizationId: req.org.id,
            url,
        }).catch(async (err) => {
            console.error('[agents] Failed to enqueue scraping job:', err);
            await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`, ['Processing queue unavailable. Click reprocess to retry.', file.id]).catch(() => { });
            return null;
        });
        console.log(`[agents] URL ${file.id} added, scraping job: ${scrapeEnqueued ? String(scrapeEnqueued.id) : 'FAILED'}`);
        res.status(201).json({ file });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/knowledge/:fileId/reprocess
router.post('/:id/knowledge/:fileId/reprocess', (0, validateUUID_1.validateUUID)('id', 'fileId'), async (req, res, next) => {
    try {
        const file = await agentService.reprocessKnowledgeFile(req.org.id, String(req.params['id']), String(req.params['fileId']));
        // Re-enqueue appropriate processing job
        if (file.fileType === 'web') {
            await queues_1.scrapingQueue.add('scrape-url', {
                fileId: file.id,
                agentId: String(req.params['id']),
                organizationId: req.org.id,
                url: file.sourceUrl ?? '',
            }).catch(async (err) => {
                console.error('[agents] Failed to re-enqueue scraping job:', err);
                await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`, ['Processing queue unavailable. Try again later.', file.id]).catch(() => { });
            });
        }
        else {
            await queues_1.ragQueue.add('process-file', {
                fileId: file.id,
                agentId: String(req.params['id']),
                organizationId: req.org.id,
            }).catch(async (err) => {
                console.error('[agents] Failed to re-enqueue RAG job:', err);
                await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`, ['Processing queue unavailable. Try again later.', file.id]).catch(() => { });
            });
        }
        res.json({ file });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/agents/:id/knowledge/:fileId
router.delete('/:id/knowledge/:fileId', (0, validateUUID_1.validateUUID)('id', 'fileId'), async (req, res, next) => {
    try {
        await agentService.deleteKnowledgeFile(req.org.id, String(req.params['id']), String(req.params['fileId']));
        res.json({ message: 'File deleted successfully' });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/agents/:id/config-schema
// Returns the effective config variables schema (template ⨁ overrides),
// merged and ordered, plus the agent's current values.
router.get('/:id/config-schema', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const result = await agentService.getConfigSchema(req.org.id, String(req.params['id']));
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/agents/:id/config-values
// Body: { values: { [key: string]: any } }
// Partial update — validates against the effective schema, then JSONB-merges.
router.patch('/:id/config-values', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object' || !body.values || typeof body.values !== 'object') {
            res.status(400).json({ error: { message: '`values` object is required', code: 'INVALID_INPUT' } });
            return;
        }
        const result = await agentService.patchConfigValues(req.org.id, String(req.params['id']), body.values);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/agents/:id/config-overrides
// Body: { overrides: ConfigVariableSchema[] }
// Replaces the agent's schema overrides entirely.
router.put('/:id/config-overrides', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const body = req.body;
        const result = await agentService.replaceConfigOverrides(req.org.id, String(req.params['id']), body?.overrides ?? []);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/agents/:id
router.get('/:id', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const agent = await agentService.getAgentById(req.org.id, String(req.params['id']));
        res.json({ agent });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/agents/:id
router.put('/:id', (0, validateUUID_1.validateUUID)('id'), (0, validate_1.validate)(shared_1.agentUpdateSchema), async (req, res, next) => {
    try {
        // Plan enforcement for maxTokens and contextWindowMessages
        const plan = req.org.plan;
        const planLimits = shared_1.PLAN_LIMITS[plan];
        const body = req.body;
        if (planLimits && typeof body['maxTokens'] === 'number') {
            body['maxTokens'] = Math.min(body['maxTokens'], planLimits.maxTokensPerResponse);
        }
        if (planLimits && typeof body['contextWindowMessages'] === 'number') {
            body['contextWindowMessages'] = Math.min(body['contextWindowMessages'], planLimits.contextWindowMessages);
        }
        const agent = await agentService.updateAgent(req.org.id, String(req.params['id']), body);
        res.json({ agent });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/agents/:id
router.delete('/:id', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        await agentService.deleteAgent(req.org.id, String(req.params['id']));
        res.json({ message: 'Agent deleted successfully' });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/publish
router.post('/:id/publish', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const result = await agentService.publishAgent(req.org.id, String(req.params['id']), req.user.userId);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/agents/:id/versions
router.get('/:id/versions', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const versions = await agentService.getVersions(req.org.id, String(req.params['id']));
        res.json({ versions });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/rollback/:versionId
router.post('/:id/rollback/:versionId', (0, validateUUID_1.validateUUID)('id', 'versionId'), async (req, res, next) => {
    try {
        const agent = await agentService.rollbackAgent(req.org.id, String(req.params['id']), String(req.params['versionId']));
        res.json({ agent });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/preview — Enhanced with tools, RAG, variable capture, persistent history
router.post('/:id/preview', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const agentId = String(req.params['id']);
        const { message, systemPrompt } = req.body;
        if (!message?.trim()) {
            res.status(400).json({ error: { message: 'Message is required', code: 'MISSING_MESSAGE' } });
            return;
        }
        const { redis } = await Promise.resolve().then(() => __importStar(require('../config/redis')));
        const { chat } = await Promise.resolve().then(() => __importStar(require('../services/llm.service')));
        const { buildVariableCaptureInstructions, captureVariableToolDef, } = await Promise.resolve().then(() => __importStar(require('../services/variable-capture.service')));
        const { sendMediaToolDef } = await Promise.resolve().then(() => __importStar(require('../services/send-media.service')));
        const { validateMediaUrl } = await Promise.resolve().then(() => __importStar(require('../services/media-validator.service')));
        const { queryKnowledgeBase, hasKnowledgeBase } = await Promise.resolve().then(() => __importStar(require('../services/rag.service')));
        const { executeCustomFunction } = await Promise.resolve().then(() => __importStar(require('../services/custom-function.service')));
        // Fetch agent
        const agentResult = await agentService.getAgentById(req.org.id, agentId);
        const previewKey = `preview:${agentId}:${req.user.userId}`;
        const previewSessionKey = `preview-session:${agentId}:${req.user.userId}`;
        const TTL = 30 * 60; // 30 minutes
        // Stable per-(agent,user) session UUID for MCP X-Session-ID. Mirrors the
        // worker's behaviour where one conversation = one session = persistent
        // cart on the MCP side. Reset alongside preview history.
        let previewSessionId = await redis.get(previewSessionKey);
        if (!previewSessionId) {
            previewSessionId = (0, crypto_1.randomUUID)();
            await redis.set(previewSessionKey, previewSessionId, 'EX', TTL);
        }
        // Load stored history
        const rawHistory = await redis.get(previewKey);
        const history = rawHistory ? JSON.parse(rawHistory) : [];
        // Build system prompt
        // Day 21: inject {{config.X}} placeholders BEFORE appending variable
        // capture instructions / RAG / scheduling. Worker and preview must
        // agree on substitution semantics — both go through
        // agent-config.service.renderSystemPromptWithConfig.
        const { renderSystemPromptWithConfig: injectConfig, loadAgentConfigForDeepInject } = await Promise.resolve().then(() => __importStar(require('../services/agent-config.service')));
        const variables = Array.isArray(agentResult.variables) ? agentResult.variables : [];
        const variableInstructions = buildVariableCaptureInstructions(variables);
        const rawPrompt = systemPrompt ?? agentResult.systemPrompt ?? '';
        let fullSystemPrompt = await injectConfig(agentId, rawPrompt);
        if (variableInstructions)
            fullSystemPrompt += '\n\n' + variableInstructions;
        // RAG context
        const hasRAG = await hasKnowledgeBase(agentId);
        if (hasRAG) {
            const ragContext = await queryKnowledgeBase(agentId, message.trim());
            if (ragContext)
                fullSystemPrompt += '\n\n' + ragContext;
        }
        // Fetch tools
        const toolsResult = await (0, database_1.query)('SELECT id, type, name, description, config, is_enabled FROM agent_tools WHERE agent_id = $1 AND is_enabled = true', [agentId]);
        const llmTools = [];
        if (variables.length > 0)
            llmTools.push(captureVariableToolDef);
        // send_media is always available in preview (will be mocked — no real send)
        llmTools.push(sendMediaToolDef);
        for (const tool of toolsResult.rows) {
            if (tool.type === 'custom_function' && tool.is_enabled) {
                // Convert params array to JSON Schema (same fix as message.worker.ts)
                let parameters;
                const rawParams = tool.config['parameters'] ?? tool.config['params'];
                if (Array.isArray(rawParams)) {
                    const properties = {};
                    const required = [];
                    for (const p of rawParams) {
                        if (!p.name)
                            continue;
                        properties[p.name] = {
                            type: p.type || 'string',
                            description: p.description || p.name,
                        };
                        if (p.required)
                            required.push(p.name);
                    }
                    parameters = { type: 'object', properties, required };
                }
                else if (rawParams && typeof rawParams === 'object' && rawParams['type'] === 'object') {
                    parameters = rawParams;
                }
                else {
                    parameters = { type: 'object', properties: {}, required: [] };
                }
                llmTools.push({
                    name: tool.name.replace(/\s+/g, '_').toLowerCase(),
                    description: tool.description ?? tool.name,
                    parameters,
                });
            }
            if (tool.type === 'email_notification' && tool.is_enabled) {
                const cfg = tool.config;
                llmTools.push((0, send_email_notification_service_1.buildEmailNotificationToolDef)(tool.name, tool.description ?? tool.name, cfg));
            }
            if (tool.type === 'scheduling') {
                const { resolveCalendarIds } = await Promise.resolve().then(() => __importStar(require('../services/calendar.service')));
                const calendarIds = resolveCalendarIds(tool.config);
                const hasMultipleCalendars = calendarIds.length > 1;
                llmTools.push({
                    name: 'check_availability',
                    description: 'Check available appointment slots for a given date. Use when the user wants to schedule or book an appointment.',
                    parameters: {
                        type: 'object',
                        properties: {
                            date: { type: 'string', description: 'Date to check availability (YYYY-MM-DD)' },
                            ...(hasMultipleCalendars ? {
                                calendar_id: { type: 'string', description: 'ID of the specific calendar to check availability on. You MUST determine the correct calendar based on the conversation context and your instructions.' },
                            } : {}),
                        },
                        required: hasMultipleCalendars ? ['date', 'calendar_id'] : ['date'],
                    },
                }, {
                    name: 'book_appointment',
                    description: 'Book an appointment at a specific date and time. Use after the user confirms a slot.',
                    parameters: {
                        type: 'object',
                        properties: {
                            date: { type: 'string', description: 'Appointment date (YYYY-MM-DD)' },
                            time: { type: 'string', description: 'Appointment start time (HH:MM)' },
                            name: { type: 'string', description: 'Name of the person booking' },
                            ...(hasMultipleCalendars ? {
                                calendar_id: { type: 'string', description: 'ID of the specific calendar to book on. You MUST determine the correct calendar based on the conversation context and your instructions.' },
                            } : {}),
                        },
                        required: hasMultipleCalendars ? ['date', 'time', 'calendar_id'] : ['date', 'time'],
                    },
                });
            }
        }
        // MCP tools — same loading pattern as message.worker.ts (with cache),
        // but using previewSessionId for X-Session-ID so the preview chat shares
        // a cart/session with the MCP across turns until /preview/reset.
        const mcpToolMap = {};
        const MCP_TOOLS_CACHE_TTL = 3600;
        for (const tool of toolsResult.rows) {
            if (tool.type !== 'mcp' || !tool.is_enabled)
                continue;
            const cfg = tool.config;
            const serverUrl = cfg.server_url ?? cfg.serverUrl ?? '';
            const serverName = cfg.name ?? cfg.serverName ?? 'mcp';
            const selectedTools = cfg.selected_tools ?? [];
            const mcpTransport = (cfg.transport === 'streamable-http' ? 'streamable-http' : 'sse');
            if (!serverUrl || selectedTools.length === 0)
                continue;
            // Same 3-layer merge as message.worker.ts (profile → user → system).
            let profileAutoHeaders = {};
            if (cfg.providerId) {
                try {
                    const profile = await mcpProviders.findProfileById(cfg.providerId);
                    if (profile && profile.is_active) {
                        profileAutoHeaders = await mcpProviders.resolveAutoHeaders(profile);
                    }
                }
                catch (err) {
                    console.error(`[preview] Failed to resolve provider ${cfg.providerId} for tool ${tool.id}:`, err.message);
                }
            }
            const userHeaders = (0, mcp_headers_service_1.decryptHeaders)(cfg.headers);
            const autoHeaders = {
                'X-Agent-ID': agentId,
                'X-Session-ID': previewSessionId,
            };
            if (cfg.webhookSecret_encrypted) {
                try {
                    autoHeaders['X-Webhook-Secret'] = (0, encryption_1.decrypt)(cfg.webhookSecret_encrypted);
                }
                catch (err) {
                    console.error(`[preview] Failed to decrypt webhookSecret for tool ${tool.id}:`, err.message);
                }
            }
            const allHeaders = { ...profileAutoHeaders, ...userHeaders, ...autoHeaders };
            try {
                const cacheKey = `mcp:tools:${tool.id}`;
                let toolDefs = null;
                const cached = await redis.get(cacheKey).catch(() => null);
                if (cached) {
                    try {
                        toolDefs = JSON.parse(cached);
                    }
                    catch {
                        toolDefs = null;
                    }
                }
                if (!toolDefs) {
                    toolDefs = await (0, mcp_client_service_1.connectAndListTools)(serverUrl, mcpTransport, allHeaders);
                    await redis.setex(cacheKey, MCP_TOOLS_CACHE_TTL, JSON.stringify(toolDefs)).catch(() => { });
                }
                const sanitizedServerName = (0, mcp_client_service_1.sanitizeName)(serverName);
                for (const toolDef of toolDefs) {
                    if (!selectedTools.includes(toolDef.name))
                        continue;
                    const prefixedName = `mcp_${sanitizedServerName}_${(0, mcp_client_service_1.sanitizeName)(toolDef.name)}`;
                    llmTools.push({
                        name: prefixedName,
                        description: `[MCP:${serverName}] ${toolDef.description}`,
                        parameters: toolDef.inputSchema,
                    });
                    mcpToolMap[prefixedName] = {
                        serverUrl,
                        originalToolName: toolDef.name,
                        transport: mcpTransport,
                        extraHeaders: allHeaders,
                    };
                }
            }
            catch (err) {
                console.error(`[preview] Failed to load MCP tools for tool ${tool.id}:`, err.message);
            }
        }
        // Add scheduling instructions to system prompt if a scheduling tool is enabled
        if (toolsResult.rows.some((t) => t.type === 'scheduling')) {
            const { resolveCalendarIds } = await Promise.resolve().then(() => __importStar(require('../services/calendar.service')));
            const todayDate = new Date().toISOString().split('T')[0];
            const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const currentYear = new Date().getFullYear();
            const schedulingTool = toolsResult.rows.find((t) => t.type === 'scheduling');
            const calendarIds = schedulingTool ? resolveCalendarIds(schedulingTool.config) : [];
            if (calendarIds.length > 1) {
                const calResult = await (0, database_1.query)('SELECT id, name FROM calendars WHERE id = ANY($1::uuid[])', [calendarIds]);
                const calList = calResult.rows.map((c) => `- "${c.name}" → calendar_id: ${c.id}`).join('\n');
                fullSystemPrompt += `\n\nToday's date is ${todayDate} (${todayDay}). Always use the current year (${currentYear}) when interpreting user-mentioned dates and always output dates in YYYY-MM-DD format.\n\nYou have access to a scheduling system with multiple calendars:\n${calList}\n\nIMPORTANT: Use your system prompt instructions and the conversation context to determine which calendar to use. Do NOT ask the user which calendar or doctor — infer it from the conversation logic defined in your prompt. When calling check_availability or book_appointment, you MUST include the correct calendar_id based on your reasoning.\n\nScheduling flow:\n1. Determine the correct calendar based on conversation context and your prompt rules\n2. Call check_availability with the date AND the calendar_id\n3. Present the available slots to the user\n4. When the user confirms a slot, call book_appointment with date, time, name, and calendar_id`;
            }
            else {
                fullSystemPrompt += `\n\nToday's date is ${todayDate} (${todayDay}). Always use the current year (${currentYear}) when interpreting user-mentioned dates and always output dates in YYYY-MM-DD format.\n\nYou have access to a scheduling system. When the user wants to book an appointment:\n1. First call check_availability with the requested date (YYYY-MM-DD, year ${currentYear}) to see available time slots\n2. Present the available slots to the user\n3. When the user confirms a slot, call book_appointment with the date, time, and the user's name`;
            }
        }
        // LLM call
        const startTime = Date.now();
        let capturedVars = {};
        const toolsCalledLog = [];
        const previewMedia = [];
        let finalResponse = '';
        let totalTokens = 0;
        const messages = [
            ...history.map((h) => ({
                role: h.role,
                content: h.content,
            })),
            { role: 'user', content: message.trim() },
        ];
        let currentMessages = [...messages];
        const maxIter = 5;
        const planLimits = shared_1.PLAN_LIMITS[req.org.plan];
        const effectiveMaxTokens = Math.min(agentResult.maxTokens, planLimits?.maxTokensPerResponse ?? 512);
        try {
            for (let i = 0; i < maxIter; i++) {
                const response = await chat({
                    provider: agentResult.llmProvider,
                    model: agentResult.llmModel,
                    system: fullSystemPrompt,
                    messages: currentMessages,
                    tools: llmTools.length > 0 ? llmTools : undefined,
                    temperature: agentResult.temperature,
                    maxTokens: effectiveMaxTokens,
                });
                totalTokens += response.usage.totalTokens;
                if (!response.toolCalls?.length) {
                    const { cleaned, extractedCaptures } = (0, text_1.stripAndExtractToolCallArtifacts)(response.content);
                    // Preview: recover leaked captures into capturedVars (no DB writes in preview).
                    for (const ec of extractedCaptures) {
                        capturedVars[ec.variableName] = ec.variableValue;
                        toolsCalledLog.push(`capture_variable[recovered]`);
                    }
                    finalResponse = cleaned;
                    break;
                }
                const previewToolResults = [];
                for (const tc of response.toolCalls) {
                    toolsCalledLog.push(tc.name);
                    if (tc.name === 'capture_variable') {
                        const name = String(tc.arguments['variable_name'] ?? '');
                        const val = String(tc.arguments['variable_value'] ?? '');
                        capturedVars[name] = val;
                        previewToolResults.push({ toolCallId: tc.id, content: `Variable '${name}' captured: ${val}` });
                    }
                    else if (tc.name === 'check_availability') {
                        const { getAvailableSlots, resolveCalendarIds } = await Promise.resolve().then(() => __importStar(require('../services/calendar.service')));
                        const date = String(tc.arguments['date'] ?? '');
                        // Multi-calendar: prefer calendar_id from LLM args, fallback to first in config
                        let calendarId = String(tc.arguments['calendar_id'] ?? '');
                        if (!calendarId) {
                            const schedulingTool = toolsResult.rows.find((t) => t.type === 'scheduling');
                            const calIds = schedulingTool ? resolveCalendarIds(schedulingTool.config) : [];
                            calendarId = calIds[0] ?? '';
                        }
                        let slotResult = 'No calendar configured for this agent.';
                        if (calendarId && date) {
                            try {
                                const slots = await getAvailableSlots(calendarId, date);
                                slotResult = slots.length
                                    ? `Available slots for ${date}: ${slots.map((s) => s.start).join(', ')}. Which time works best?`
                                    : `No available slots for ${date}. Please try another date.`;
                            }
                            catch {
                                slotResult = `Could not check availability for ${date}.`;
                            }
                        }
                        previewToolResults.push({ toolCallId: tc.id, content: slotResult });
                    }
                    else if (tc.name === 'book_appointment') {
                        const { createAppointment } = await Promise.resolve().then(() => __importStar(require('../services/appointment.service')));
                        const { localTimeToUTC, resolveCalendarIds } = await Promise.resolve().then(() => __importStar(require('../services/calendar.service')));
                        const date = String(tc.arguments['date'] ?? '');
                        const time = String(tc.arguments['time'] ?? '');
                        const personName = String(tc.arguments['name'] ?? 'Guest');
                        // Multi-calendar: prefer calendar_id from LLM args, fallback to first in config
                        let calendarId = String(tc.arguments['calendar_id'] ?? '');
                        if (!calendarId) {
                            const schedulingTool = toolsResult.rows.find((t) => t.type === 'scheduling');
                            const calIds = schedulingTool ? resolveCalendarIds(schedulingTool.config) : [];
                            calendarId = calIds[0] ?? '';
                        }
                        let bookResult = 'Could not book appointment — missing information.';
                        if (calendarId && date && time) {
                            try {
                                const calResult = await (0, database_1.query)('SELECT slot_duration, timezone FROM calendars WHERE id = $1', [calendarId]);
                                const slotDuration = calResult.rows[0]?.slot_duration ?? 30;
                                const calTz = calResult.rows[0]?.timezone || 'UTC';
                                const startUTC = localTimeToUTC(date, time, calTz);
                                const startTime = startUTC.toISOString();
                                const endTime = new Date(startUTC.getTime() + slotDuration * 60000).toISOString();
                                await createAppointment(req.org.id, {
                                    calendarId,
                                    contactId: null,
                                    title: `Appointment — ${personName}`,
                                    startTime,
                                    endTime,
                                });
                                bookResult = `Appointment confirmed for ${date} at ${time} for ${personName}.`;
                            }
                            catch (err) {
                                bookResult = `Could not book appointment: ${err.message}`;
                            }
                        }
                        previewToolResults.push({ toolCallId: tc.id, content: bookResult });
                    }
                    else if (tc.name === 'send_media') {
                        // In preview mode: validate URL but do NOT actually send to WhatsApp/widget.
                        const mediaType = String(tc.arguments['type'] ?? 'image');
                        const mediaUrl = String(tc.arguments['url'] ?? '');
                        const mediaCaption = tc.arguments['caption'] ? String(tc.arguments['caption']) : undefined;
                        let previewResult;
                        let mediaValid = false;
                        let mediaError;
                        if (!mediaUrl) {
                            previewResult = '[Preview] send_media: URL is required.';
                            mediaError = 'URL is required';
                        }
                        else {
                            try {
                                const validation = await validateMediaUrl(mediaUrl, mediaType);
                                if (validation.valid) {
                                    mediaValid = true;
                                    previewResult = `[Preview] Media (${mediaType}) would be sent successfully. Caption: "${mediaCaption ?? '(none)'}"`;
                                }
                                else {
                                    mediaError = validation.error ?? validation.errorCode ?? 'Invalid URL';
                                    previewResult = `[Preview] Could not send media: ${mediaError}`;
                                }
                            }
                            catch {
                                mediaError = 'URL validation failed';
                                previewResult = `[Preview] Could not send media: ${mediaError}`;
                            }
                        }
                        previewMedia.push({
                            type: mediaType,
                            url: mediaUrl,
                            caption: mediaCaption,
                            valid: mediaValid,
                            error: mediaError,
                        });
                        previewToolResults.push({ toolCallId: tc.id, content: previewResult });
                    }
                    else if (tc.name.startsWith('mcp_') && mcpToolMap[tc.name]) {
                        // MCP tool — executes against the real server (e.g. create_order
                        // creates a real Mastershop order). Acceptable in preview because
                        // the user is testing E2E. Reset clears the session/cart.
                        const { serverUrl, originalToolName, transport, extraHeaders } = mcpToolMap[tc.name];
                        try {
                            const result = await (0, mcp_client_service_1.executeMCPTool)(serverUrl, originalToolName, tc.arguments, transport, extraHeaders);
                            previewToolResults.push({ toolCallId: tc.id, content: result.content });
                        }
                        catch (err) {
                            previewToolResults.push({
                                toolCallId: tc.id,
                                content: `MCP tool execution failed: ${err.message}`,
                            });
                        }
                    }
                    else {
                        // Check if this is an email_notification tool
                        const emailNotifTool = toolsResult.rows.find((t) => t.type === 'email_notification' &&
                            t.name.replace(/\s+/g, '_').toLowerCase() === tc.name);
                        if (emailNotifTool) {
                            // In preview mode: validate parameters but do NOT actually send the email
                            const cfg = emailNotifTool.config;
                            const missingParams = [];
                            for (const p of cfg.parameters || []) {
                                if (p.required &&
                                    (tc.arguments[p.name] === undefined ||
                                        tc.arguments[p.name] === null ||
                                        tc.arguments[p.name] === '')) {
                                    missingParams.push(p.name);
                                }
                            }
                            if (missingParams.length > 0) {
                                previewToolResults.push({
                                    toolCallId: tc.id,
                                    content: `[Preview] Missing required parameters: ${missingParams.join(', ')}`,
                                });
                            }
                            else {
                                previewToolResults.push({
                                    toolCallId: tc.id,
                                    content: `[Preview] Email notification would be sent to ${cfg.recipientEmail}. Subject: "${cfg.subject}". Parameters captured: ${JSON.stringify(tc.arguments)}`,
                                });
                            }
                        }
                        else {
                            const toolDef = toolsResult.rows.find((t) => t.name.replace(/\s+/g, '_').toLowerCase() === tc.name);
                            if (toolDef) {
                                const { schema, values } = await loadAgentConfigForDeepInject(agentId);
                                const resolvedConfig = (0, shared_1.injectConfigVariablesDeep)(toolDef.config, schema, values);
                                console.log(`[agents.preview] Custom function "${tc.name}" — config resolved`);
                                const result = await executeCustomFunction(resolvedConfig, tc.arguments);
                                previewToolResults.push({ toolCallId: tc.id, content: result });
                            }
                        }
                    }
                }
                // Append structured assistant + tool result messages (Anthropic-compatible)
                currentMessages.push({
                    role: 'assistant',
                    content: response.content || '',
                    toolCalls: response.toolCalls,
                });
                currentMessages.push({
                    role: 'user',
                    content: '',
                    toolResults: previewToolResults,
                });
                if (response.content.trim()) {
                    const { cleaned, extractedCaptures } = (0, text_1.stripAndExtractToolCallArtifacts)(response.content);
                    for (const ec of extractedCaptures) {
                        capturedVars[ec.variableName] = ec.variableValue;
                        toolsCalledLog.push(`capture_variable[recovered]`);
                    }
                    finalResponse = cleaned;
                }
            }
        }
        catch (err) {
            // Retry once without tools — replica worker pattern (hotfix #57-60)
            console.error('[agents.preview] LLM failed in loop, retrying:', err.message);
            try {
                const retryResponse = await chat({
                    provider: agentResult.llmProvider,
                    model: agentResult.llmModel,
                    system: fullSystemPrompt,
                    messages,
                    temperature: agentResult.temperature,
                    maxTokens: effectiveMaxTokens,
                });
                finalResponse = (0, text_1.stripAndExtractToolCallArtifacts)(retryResponse.content).cleaned;
                totalTokens = retryResponse.usage.totalTokens;
            }
            catch (retryErr) {
                console.error('[agents.preview] LLM failed after retry:', retryErr.message);
                throw retryErr;
            }
        }
        // Guard against minimal/empty responses — replica worker pattern (hotfix #94)
        const isMinimalResponse = (text) => {
            const stripped = text.replace(/[\s\p{P}]/gu, '');
            return stripped.length < 5;
        };
        if (isMinimalResponse(finalResponse)) {
            console.warn(`[agents.preview] Minimal LLM response detected: "${finalResponse}" — retrying`);
            try {
                const retryResponse = await chat({
                    provider: agentResult.llmProvider,
                    model: agentResult.llmModel,
                    system: fullSystemPrompt,
                    messages,
                    temperature: agentResult.temperature,
                    maxTokens: effectiveMaxTokens,
                });
                if (!isMinimalResponse(retryResponse.content)) {
                    finalResponse = (0, text_1.stripAndExtractToolCallArtifacts)(retryResponse.content).cleaned;
                    totalTokens += retryResponse.usage.totalTokens;
                }
                else {
                    console.warn(`[agents.preview] Retry also returned minimal response: "${retryResponse.content}"`);
                    finalResponse = agentResult.llmProvider === 'anthropic'
                        ? 'Disculpa, no pude procesar tu mensaje. ¿Podrías repetirlo?'
                        : 'Sorry, I could not process your message. Could you please repeat it?';
                }
            }
            catch (retryErr) {
                console.error('[agents.preview] Retry for minimal response failed:', retryErr.message);
                finalResponse = 'Sorry, I could not process your message. Could you please repeat it?';
            }
        }
        // Persist updated history
        const updatedHistory = [
            ...history,
            { role: 'user', content: message.trim() },
            { role: 'assistant', content: finalResponse },
        ];
        await redis.set(previewKey, JSON.stringify(updatedHistory), 'EX', TTL);
        const latencyMs = Date.now() - startTime;
        res.json({
            message: finalResponse,
            metadata: {
                tokensUsed: totalTokens,
                toolsCalled: toolsCalledLog,
                capturedVariables: capturedVars,
                previewMedia,
                latencyMs,
                model: agentResult.llmModel,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/agents/:id/preview/reset
router.post('/:id/preview/reset', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const agentId = String(req.params['id']);
        const { redis } = await Promise.resolve().then(() => __importStar(require('../config/redis')));
        const previewKey = `preview:${agentId}:${req.user.userId}`;
        const previewSessionKey = `preview-session:${agentId}:${req.user.userId}`;
        // Clear both: history AND the MCP session UUID (so the next message
        // starts a fresh session/cart on any connected MCP).
        await Promise.all([
            redis.del(previewKey).catch(() => { }),
            redis.del(previewSessionKey).catch(() => { }),
        ]);
        res.json({ message: 'Preview history cleared' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=agents.js.map