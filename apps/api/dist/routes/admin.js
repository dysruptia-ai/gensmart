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
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const superAdmin_1 = require("../middleware/superAdmin");
const validate_1 = require("../middleware/validate");
const database_1 = require("../config/database");
const platformSettings = __importStar(require("../services/platform-settings.service"));
const mcpProviders = __importStar(require("../services/mcp-providers.service"));
const router = (0, express_1.Router)();
// All admin routes require auth + super admin
router.use(auth_1.requireAuth);
router.use(superAdmin_1.requireSuperAdmin);
// ─── Platform Settings ───────────────────────────────────────
// GET /api/admin/settings — List all platform settings (masked)
router.get('/settings', async (_req, res, next) => {
    try {
        const settings = await platformSettings.getAllSettings();
        res.json(settings);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/settings/all — All settings with category metadata for dynamic UI
// Encrypted values never leave the server — only has_value flag is returned.
router.get('/settings/all', async (_req, res, next) => {
    try {
        const settings = await platformSettings.getAllSettingsWithMeta();
        res.json(settings);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/settings/:key — Get single setting
router.get('/settings/:key', async (req, res, next) => {
    try {
        const setting = await platformSettings.getSetting(String(req.params['key']));
        if (!setting) {
            res.status(404).json({ error: { message: 'Setting not found', code: 'NOT_FOUND' } });
            return;
        }
        res.json(setting);
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/admin/settings/:key — Update setting value
const updateSettingSchema = zod_1.z.object({
    value: zod_1.z.string(),
});
router.put('/settings/:key', (0, validate_1.validate)(updateSettingSchema), async (req, res, next) => {
    try {
        await platformSettings.setSettingValue(String(req.params['key']), req.body.value, req.user.userId);
        res.json({ message: 'Setting updated successfully' });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/settings/test-whatsapp — Test WhatsApp token validity
router.post('/settings/test-whatsapp', async (_req, res, next) => {
    try {
        const token = await platformSettings.getWhatsAppToken();
        if (!token) {
            res.json({ valid: false, error: 'No WhatsApp token configured' });
            return;
        }
        const result = await platformSettings.testWhatsAppToken(token);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// ─── Organizations Management ────────────────────────────────
// GET /api/admin/organizations — List all orgs
router.get('/organizations', async (req, res, next) => {
    try {
        const search = req.query['search'] || '';
        const page = parseInt(req.query['page']) || 1;
        const limit = Math.min(parseInt(req.query['limit']) || 20, 100);
        const offset = (page - 1) * limit;
        let whereClause = '';
        const params = [];
        let paramIdx = 1;
        if (search) {
            whereClause = `WHERE o.name ILIKE $${paramIdx} OR EXISTS (
          SELECT 1 FROM users u2 WHERE u2.organization_id = o.id AND u2.email ILIKE $${paramIdx}
        )`;
            params.push(`%${search}%`);
            paramIdx++;
        }
        const countResult = await (0, database_1.query)(`SELECT COUNT(DISTINCT o.id) as count FROM organizations o ${whereClause}`, params);
        const total = parseInt(countResult.rows[0]?.count || '0');
        const orgsResult = await (0, database_1.query)(`SELECT
          o.id, o.name, o.slug, o.plan, o.subscription_status, o.created_at, o.trial_ends_at,
          (SELECT COUNT(*) FROM agents a WHERE a.organization_id = o.id)::text as agents_count,
          (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id)::text as users_count
        FROM organizations o
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`, [...params, limit, offset]);
        // Get current month message usage for each org
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const orgIds = orgsResult.rows.map((o) => o.id);
        let usageMap = {};
        if (orgIds.length > 0) {
            const usageResult = await (0, database_1.query)(`SELECT organization_id, SUM(value)::text as total
           FROM usage_logs
           WHERE organization_id = ANY($1) AND metric = 'messages' AND period >= $2::date
           GROUP BY organization_id`, [orgIds, `${period}-01`]);
            usageMap = Object.fromEntries(usageResult.rows.map((r) => [r.organization_id, parseInt(r.total)]));
        }
        const orgs = orgsResult.rows.map((o) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            plan: o.plan,
            subscriptionStatus: o.subscription_status,
            trialEndsAt: o.trial_ends_at,
            agentsCount: parseInt(o.agents_count),
            usersCount: parseInt(o.users_count),
            messagesUsed: usageMap[o.id] || 0,
            createdAt: o.created_at,
        }));
        res.json({ organizations: orgs, total, page, limit });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/organizations/:id — Org detail
router.get('/organizations/:id', async (req, res, next) => {
    try {
        const orgId = String(req.params['id']);
        const orgResult = await (0, database_1.query)(`SELECT id, name, slug, plan, subscription_status, stripe_customer_id,
                stripe_subscription_id, current_period_start, current_period_end,
                trial_ends_at, settings, created_at
         FROM organizations WHERE id = $1`, [orgId]);
        if (orgResult.rows.length === 0) {
            res.status(404).json({ error: { message: 'Organization not found', code: 'NOT_FOUND' } });
            return;
        }
        const org = orgResult.rows[0];
        // Users
        const usersResult = await (0, database_1.query)(`SELECT id, email, name, role, totp_enabled, last_login_at, created_at
         FROM users WHERE organization_id = $1 ORDER BY created_at`, [orgId]);
        // Agents
        const agentsResult = await (0, database_1.query)(`SELECT id, name, status, llm_provider, llm_model, channels, created_at
         FROM agents WHERE organization_id = $1 ORDER BY created_at DESC`, [orgId]);
        res.json({
            organization: {
                ...org,
                subscriptionStatus: org.subscription_status,
                stripeCustomerId: org.stripe_customer_id,
                stripeSubscriptionId: org.stripe_subscription_id,
                currentPeriodStart: org.current_period_start,
                currentPeriodEnd: org.current_period_end,
                trialEndsAt: org.trial_ends_at,
            },
            users: usersResult.rows.map((u) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                role: u.role,
                totpEnabled: u.totp_enabled,
                lastLoginAt: u.last_login_at,
                createdAt: u.created_at,
            })),
            agents: agentsResult.rows.map((a) => ({
                id: a.id,
                name: a.name,
                status: a.status,
                llmProvider: a.llm_provider,
                llmModel: a.llm_model,
                channels: a.channels,
                createdAt: a.created_at,
            })),
        });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/admin/organizations/:id/plan — Change org plan manually
const changePlanSchema = zod_1.z.object({
    plan: zod_1.z.enum(['free', 'starter', 'pro', 'enterprise']),
});
router.put('/organizations/:id/plan', (0, validate_1.validate)(changePlanSchema), async (req, res, next) => {
    try {
        const orgId = String(req.params['id']);
        await (0, database_1.query)('UPDATE organizations SET plan = $1, updated_at = NOW() WHERE id = $2', [req.body.plan, orgId]);
        res.json({ message: `Plan updated to ${req.body.plan}` });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/admin/organizations/:id/reset-2fa — Reset 2FA for a user
const reset2FASchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
});
router.post('/organizations/:id/reset-2fa', (0, validate_1.validate)(reset2FASchema), async (req, res, next) => {
    try {
        const { userId } = req.body;
        const orgId = String(req.params['id']);
        // Verify user belongs to this org
        const userCheck = await (0, database_1.query)('SELECT id FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
        if (userCheck.rows.length === 0) {
            res.status(404).json({ error: { message: 'User not found in this organization', code: 'NOT_FOUND' } });
            return;
        }
        // Reset 2FA
        await (0, database_1.query)(`UPDATE users SET totp_enabled = FALSE, totp_secret_encrypted = NULL, updated_at = NOW() WHERE id = $1`, [userId]);
        // Delete backup codes
        await (0, database_1.query)('DELETE FROM backup_codes WHERE user_id = $1', [userId]);
        res.json({ message: '2FA reset successfully' });
    }
    catch (err) {
        next(err);
    }
});
// ─── Platform Dashboard ──────────────────────────────────────
// GET /api/admin/dashboard/stats — Platform-wide metrics
router.get('/dashboard/stats', async (_req, res, next) => {
    try {
        const [orgsCount, agentsCount, activeAgents, usersCount] = await Promise.all([
            (0, database_1.query)('SELECT COUNT(*) as count FROM organizations'),
            (0, database_1.query)('SELECT COUNT(*) as count FROM agents'),
            (0, database_1.query)("SELECT COUNT(*) as count FROM agents WHERE status = 'active'"),
            (0, database_1.query)('SELECT COUNT(*) as count FROM users'),
        ]);
        // Messages today
        const today = new Date().toISOString().split('T')[0];
        const msgsToday = await (0, database_1.query)(`SELECT COUNT(*) as count FROM messages WHERE created_at >= $1::date`, [today]);
        // Messages this month
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const msgsMonth = await (0, database_1.query)(`SELECT COUNT(*) as count FROM messages WHERE created_at >= $1::date`, [monthStart]);
        // Conversations today
        const convsToday = await (0, database_1.query)(`SELECT COUNT(*) as count FROM conversations WHERE created_at >= $1::date`, [today]);
        // Plans breakdown
        const planBreakdown = await (0, database_1.query)(`SELECT plan, COUNT(*) as count FROM organizations GROUP BY plan ORDER BY count DESC`);
        res.json({
            totalOrganizations: parseInt(orgsCount.rows[0]?.count || '0'),
            totalAgents: parseInt(agentsCount.rows[0]?.count || '0'),
            activeAgents: parseInt(activeAgents.rows[0]?.count || '0'),
            totalUsers: parseInt(usersCount.rows[0]?.count || '0'),
            messagesToday: parseInt(msgsToday.rows[0]?.count || '0'),
            messagesThisMonth: parseInt(msgsMonth.rows[0]?.count || '0'),
            conversationsToday: parseInt(convsToday.rows[0]?.count || '0'),
            planBreakdown: planBreakdown.rows.map((r) => ({
                plan: r.plan,
                count: parseInt(r.count),
            })),
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/dashboard/usage-chart — Messages over time
router.get('/dashboard/usage-chart', async (req, res, next) => {
    try {
        const days = parseInt(req.query['days']) || 30;
        const safeDays = Math.min(days, 90);
        const result = await (0, database_1.query)(`SELECT DATE(created_at) as date, COUNT(*) as count
         FROM messages
         WHERE created_at >= NOW() - $1::integer * INTERVAL '1 day'
         GROUP BY DATE(created_at)
         ORDER BY date`, [safeDays]);
        res.json(result.rows.map((r) => ({
            date: r.date,
            messages: parseInt(r.count),
        })));
    }
    catch (err) {
        next(err);
    }
});
// GET /api/admin/dashboard/recent-signups — Last 10 signups
router.get('/dashboard/recent-signups', async (_req, res, next) => {
    try {
        const result = await (0, database_1.query)('SELECT id, name, plan, created_at FROM organizations ORDER BY created_at DESC LIMIT 10');
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
// ─── MCP Provider Profiles ───────────────────────────────────
const valueRefSchema = zod_1.z.string().regex(/^(platform_setting|fixed):/, 'value_ref must start with platform_setting: or fixed:');
const autoInjectedHeaderSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).max(100),
    value_ref: valueRefSchema,
    description: zod_1.z.string().max(500).optional(),
});
const userConfigurableHeaderSchema = zod_1.z.object({
    key: zod_1.z.string().min(1).max(100),
    label_en: zod_1.z.string().min(1).max(100),
    label_es: zod_1.z.string().min(1).max(100),
    help_url: zod_1.z.string().url().optional(),
    help_text_en: zod_1.z.string().max(500).optional(),
    help_text_es: zod_1.z.string().max(500).optional(),
    required: zod_1.z.boolean(),
    min_length: zod_1.z.number().int().min(1).max(1000).optional(),
});
const matchStrategyEnum = zod_1.z.enum(['domain_contains', 'domain_exact', 'url_prefix', 'regex']);
const transportEnum = zod_1.z.enum(['sse', 'streamable-http']);
const providerCreateSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, 'id must be lowercase alphanumeric with - or _'),
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(2000).optional(),
    logo_url: zod_1.z.string().url().optional().or(zod_1.z.literal('').transform(() => undefined)),
    match_url_pattern: zod_1.z.string().min(1).max(500),
    match_strategy: matchStrategyEnum,
    default_transport: transportEnum,
    default_server_url: zod_1.z.string().url().optional().or(zod_1.z.literal('').transform(() => undefined)),
    auto_injected_headers: zod_1.z.array(autoInjectedHeaderSchema).max(20),
    user_configurable_headers: zod_1.z.array(userConfigurableHeaderSchema).max(20),
    supported_events: zod_1.z.array(zod_1.z.string().min(1).max(100)).max(50),
    is_active: zod_1.z.boolean(),
});
const providerUpdateSchema = providerCreateSchema.partial().omit({ id: true });
router.get('/mcp-providers', async (_req, res, next) => {
    try {
        const profiles = await mcpProviders.listAllProfiles();
        res.json({ providers: profiles });
    }
    catch (err) {
        next(err);
    }
});
router.get('/mcp-providers/:id', async (req, res, next) => {
    try {
        const profile = await mcpProviders.findProfileById(String(req.params['id']));
        if (!profile) {
            res.status(404).json({ error: { message: 'Provider not found', code: 'NOT_FOUND' } });
            return;
        }
        res.json({ provider: profile });
    }
    catch (err) {
        next(err);
    }
});
router.post('/mcp-providers', (0, validate_1.validate)(providerCreateSchema), async (req, res, next) => {
    try {
        const data = req.body;
        const existing = await mcpProviders.findProfileById(data.id);
        if (existing) {
            res.status(409).json({ error: { message: `Provider with id "${data.id}" already exists`, code: 'CONFLICT' } });
            return;
        }
        const profile = await mcpProviders.createProfile(data);
        res.status(201).json({ provider: profile });
    }
    catch (err) {
        next(err);
    }
});
router.put('/mcp-providers/:id', (0, validate_1.validate)(providerUpdateSchema), async (req, res, next) => {
    try {
        const id = String(req.params['id']);
        const profile = await mcpProviders.updateProfile(id, req.body);
        if (!profile) {
            res.status(404).json({ error: { message: 'Provider not found', code: 'NOT_FOUND' } });
            return;
        }
        res.json({ provider: profile });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/mcp-providers/:id', async (req, res, next) => {
    try {
        const ok = await mcpProviders.deleteProfile(String(req.params['id']));
        if (!ok) {
            res.status(404).json({ error: { message: 'Provider not found', code: 'NOT_FOUND' } });
            return;
        }
        res.json({ message: 'Provider deactivated successfully' });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map