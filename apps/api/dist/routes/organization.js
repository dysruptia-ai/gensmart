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
const orgContext_1 = require("../middleware/orgContext");
const validate_1 = require("../middleware/validate");
const database_1 = require("../config/database");
const encryption_1 = require("../config/encryption");
const shared_1 = require("@gensmart/shared");
const errorHandler_1 = require("../middleware/errorHandler");
const orgService = __importStar(require("../services/organization.service"));
const subAccountService = __importStar(require("../services/sub-account.service"));
const router = (0, express_1.Router)();
// All org routes require auth
router.use(auth_1.requireAuth, orgContext_1.orgContext);
const updateOrgSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(255).optional(),
    settings: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const inviteMemberSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(['admin', 'member']),
});
const updateRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['admin', 'member']),
});
const createSubAccountSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(255),
    label: zod_1.z.string().min(1).max(100),
});
const apiKeysSchema = zod_1.z.object({
    openai_key: zod_1.z.string().max(200).optional(),
    anthropic_key: zod_1.z.string().max(200).optional(),
});
// ── Organization ──
router.get('/', async (req, res, next) => {
    try {
        const org = await orgService.getOrganization(req.user.orgId);
        res.json(org);
    }
    catch (err) {
        next(err);
    }
});
router.put('/', (0, validate_1.validate)(updateOrgSchema), async (req, res, next) => {
    try {
        const org = await orgService.updateOrganization(req.user.orgId, req.body);
        res.json(org);
    }
    catch (err) {
        next(err);
    }
});
// ── Members ──
router.get('/members', async (req, res, next) => {
    try {
        const members = await orgService.getMembers(req.user.orgId);
        res.json(members);
    }
    catch (err) {
        next(err);
    }
});
router.post('/members/invite', (0, validate_1.validate)(inviteMemberSchema), async (req, res, next) => {
    try {
        await orgService.inviteMember(req.user.orgId, req.user.userId, req.body);
        res.status(201).json({ message: 'Invitation sent' });
    }
    catch (err) {
        next(err);
    }
});
router.put('/members/:userId/role', (0, validate_1.validate)(updateRoleSchema), async (req, res, next) => {
    try {
        await orgService.updateMemberRole(req.user.orgId, req.user.userId, String(req.params['userId']), req.body.role);
        res.json({ message: 'Role updated' });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/members/:userId', async (req, res, next) => {
    try {
        await orgService.removeMember(req.user.orgId, req.user.userId, String(req.params['userId']));
        res.json({ message: 'Member removed' });
    }
    catch (err) {
        next(err);
    }
});
// ── BYO API Keys (Enterprise only) ──
router.get('/api-keys', async (req, res, next) => {
    try {
        const plan = (req.org?.plan ?? 'free');
        if (!shared_1.PLAN_LIMITS[plan]?.byoApiKey) {
            throw new errorHandler_1.AppError(403, 'BYO API Keys require Enterprise plan', 'PLAN_LIMIT_REACHED');
        }
        const result = await (0, database_1.query)('SELECT byo_openai_key_encrypted, byo_anthropic_key_encrypted FROM organizations WHERE id = $1', [req.user.orgId]);
        const org = result.rows[0];
        // Return masked keys (last 4 chars only)
        const maskKey = (encrypted) => {
            if (!encrypted)
                return null;
            try {
                const raw = (0, encryption_1.decrypt)(encrypted);
                return `****${raw.slice(-4)}`;
            }
            catch {
                return null;
            }
        };
        res.json({
            openai_key: maskKey(org?.byo_openai_key_encrypted ?? null),
            anthropic_key: maskKey(org?.byo_anthropic_key_encrypted ?? null),
            hasOpenaiKey: Boolean(org?.byo_openai_key_encrypted),
            hasAnthropicKey: Boolean(org?.byo_anthropic_key_encrypted),
        });
    }
    catch (err) {
        next(err);
    }
});
router.put('/api-keys', (0, validate_1.validate)(apiKeysSchema), async (req, res, next) => {
    try {
        const plan = (req.org?.plan ?? 'free');
        if (!shared_1.PLAN_LIMITS[plan]?.byoApiKey) {
            throw new errorHandler_1.AppError(403, 'BYO API Keys require Enterprise plan', 'PLAN_LIMIT_REACHED');
        }
        const { openai_key, anthropic_key } = req.body;
        const updates = [];
        const values = [];
        let idx = 1;
        if (openai_key !== undefined) {
            updates.push(`byo_openai_key_encrypted = $${idx++}`);
            values.push(openai_key ? (0, encryption_1.encrypt)(openai_key) : null);
        }
        if (anthropic_key !== undefined) {
            updates.push(`byo_anthropic_key_encrypted = $${idx++}`);
            values.push(anthropic_key ? (0, encryption_1.encrypt)(anthropic_key) : null);
        }
        if (updates.length === 0) {
            res.json({ message: 'No changes' });
            return;
        }
        updates.push(`updated_at = NOW()`);
        values.push(req.user.orgId);
        await (0, database_1.query)(`UPDATE organizations SET ${updates.join(', ')} WHERE id = $${idx}`, values);
        res.json({ message: 'API keys updated' });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/organization/api-keys/test — verify a key works
router.post('/api-keys/test', async (req, res, next) => {
    try {
        const plan = (req.org?.plan ?? 'free');
        if (!shared_1.PLAN_LIMITS[plan]?.byoApiKey) {
            throw new errorHandler_1.AppError(403, 'BYO API Keys require Enterprise plan', 'PLAN_LIMIT_REACHED');
        }
        const { type, key } = req.body;
        // If no key provided, decrypt the stored key
        let testKey = key;
        if (!testKey) {
            const result = await (0, database_1.query)('SELECT byo_openai_key_encrypted, byo_anthropic_key_encrypted FROM organizations WHERE id = $1', [req.user.orgId]);
            const org = result.rows[0];
            const encrypted = type === 'openai'
                ? org?.byo_openai_key_encrypted
                : org?.byo_anthropic_key_encrypted;
            if (!encrypted) {
                throw new errorHandler_1.AppError(400, 'No key configured', 'NO_KEY');
            }
            testKey = (0, encryption_1.decrypt)(encrypted);
        }
        // Test the key with a minimal API call
        if (type === 'openai') {
            const OpenAI = (await Promise.resolve().then(() => __importStar(require('openai')))).default;
            const client = new OpenAI({ apiKey: testKey });
            await client.models.list();
        }
        else {
            const Anthropic = (await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')))).default;
            const client = new Anthropic({ apiKey: testKey });
            await client.models.list();
        }
        res.json({ valid: true });
    }
    catch (err) {
        if (err?.status === 401 || err?.message?.includes('Invalid API key')) {
            res.status(400).json({ error: { message: 'Invalid API key', code: 'INVALID_KEY' } });
            return;
        }
        next(err);
    }
});
// ── Sub-accounts ──
router.get('/sub-accounts', async (req, res, next) => {
    try {
        const subAccounts = await subAccountService.getSubAccounts(req.user.orgId);
        res.json(subAccounts);
    }
    catch (err) {
        next(err);
    }
});
router.post('/sub-accounts', (0, validate_1.validate)(createSubAccountSchema), async (req, res, next) => {
    try {
        const subAccount = await subAccountService.createSubAccount(req.user.orgId, req.body);
        res.status(201).json(subAccount);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/sub-accounts/:childOrgId', async (req, res, next) => {
    try {
        await subAccountService.removeSubAccount(req.user.orgId, String(req.params['childOrgId']));
        res.json({ message: 'Sub-account removed' });
    }
    catch (err) {
        next(err);
    }
});
router.post('/sub-accounts/:childOrgId/switch', async (req, res, next) => {
    try {
        const result = await subAccountService.switchToSubAccount(req.user.userId, req.user.email, req.user.role, req.user.orgId, String(req.params['childOrgId']));
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=organization.js.map