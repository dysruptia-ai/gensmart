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
exports.performAccountDeletion = performAccountDeletion;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const orgContext_1 = require("../middleware/orgContext");
const validate_1 = require("../middleware/validate");
const database_1 = require("../config/database");
const queues_1 = require("../config/queues");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, orgContext_1.orgContext);
const deleteAccountSchema = zod_1.z.object({
    password: zod_1.z.string().min(1),
    reason: zod_1.z.string().max(500).optional(),
});
const confirmDeleteSchema = zod_1.z.object({
    password: zod_1.z.string().min(1),
});
// ── DATA EXPORT ──────────────────────────────────────────────────────────────
// POST /api/account/export-data
// Request a new data export. Max 1 active export per org at a time.
router.post('/export-data', async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const userId = req.user.userId;
        // Check for existing active export
        const existing = await (0, database_1.query)(`SELECT id, status FROM data_export_requests
         WHERE organization_id = $1 AND status IN ('queued', 'processing')
         ORDER BY created_at DESC LIMIT 1`, [orgId]);
        if (existing.rows.length > 0) {
            res.status(409).json({
                error: { message: 'An export is already being prepared', code: 'EXPORT_IN_PROGRESS' },
                exportRequest: existing.rows[0],
            });
            return;
        }
        // Create export request
        const result = await (0, database_1.query)(`INSERT INTO data_export_requests (id, organization_id, requested_by, status, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'queued', NOW())
         RETURNING id`, [orgId, userId]);
        const exportRequest = result.rows[0];
        // Enqueue the export job
        await queues_1.exportQueue.add('export', {
            exportRequestId: exportRequest.id,
            organizationId: orgId,
        });
        res.status(201).json({ id: exportRequest.id, status: 'queued' });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/account/export-data/latest
// Get the latest export request for this org (for polling status)
router.get('/export-data/latest', async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const result = await (0, database_1.query)(`SELECT id, status, expires_at, created_at
         FROM data_export_requests
         WHERE organization_id = $1
         ORDER BY created_at DESC LIMIT 1`, [orgId]);
        if (!result.rows.length) {
            res.json(null);
            return;
        }
        const req_ = result.rows[0];
        // Mark as expired if past expires_at
        if (req_.status === 'completed' && req_.expires_at && new Date(req_.expires_at) < new Date()) {
            await (0, database_1.query)(`UPDATE data_export_requests SET status = 'expired' WHERE id = $1`, [req_.id]);
            req_.status = 'expired';
        }
        res.json(req_);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/account/export-data/:id
// Download the ZIP file if completed, or return status
router.get('/export-data/:id', async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const exportId = String(req.params['id']);
        const result = await (0, database_1.query)(`SELECT id, status, file_path, expires_at, created_at
         FROM data_export_requests
         WHERE id = $1 AND organization_id = $2`, [exportId, orgId]);
        const exportReq = result.rows[0];
        if (!exportReq) {
            throw new errorHandler_1.AppError(404, 'Export not found', 'NOT_FOUND');
        }
        if (exportReq.status !== 'completed' || !exportReq.file_path) {
            res.json({ status: exportReq.status });
            return;
        }
        if (exportReq.expires_at && new Date(exportReq.expires_at) < new Date()) {
            await (0, database_1.query)(`UPDATE data_export_requests SET status = 'expired' WHERE id = $1`, [exportId]);
            throw new errorHandler_1.AppError(410, 'Export has expired', 'EXPORT_EXPIRED');
        }
        if (!fs_1.default.existsSync(exportReq.file_path)) {
            throw new errorHandler_1.AppError(404, 'Export file not found', 'FILE_NOT_FOUND');
        }
        const date = new Date(exportReq.created_at).toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="gensmart-export-${date}.zip"`);
        fs_1.default.createReadStream(exportReq.file_path).pipe(res);
    }
    catch (err) {
        next(err);
    }
});
// ── ACCOUNT DELETION ─────────────────────────────────────────────────────────
// GET /api/account/delete/status
// Check if there is a pending deletion request
router.get('/delete/status', async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const result = await (0, database_1.query)(`SELECT id, status, scheduled_at, reason
         FROM account_deletion_requests
         WHERE organization_id = $1 AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1`, [orgId]);
        res.json(result.rows[0] ?? null);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/account/delete
// Schedule account deletion (30-day grace period)
router.post('/delete', (0, validate_1.validate)(deleteAccountSchema), async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const userId = req.user.userId;
        const { password, reason } = req.body;
        // Verify password
        const userResult = await (0, database_1.query)('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        if (!user)
            throw new errorHandler_1.AppError(404, 'User not found', 'NOT_FOUND');
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!passwordMatch)
            throw new errorHandler_1.AppError(401, 'Invalid password', 'INVALID_PASSWORD');
        // Check for existing pending request
        const existing = await (0, database_1.query)(`SELECT id FROM account_deletion_requests
         WHERE organization_id = $1 AND status = 'pending'`, [orgId]);
        if (existing.rows.length > 0) {
            res.status(409).json({
                error: { message: 'A deletion request is already pending', code: 'DELETION_PENDING' },
            });
            return;
        }
        const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const reqResult = await (0, database_1.query)(`INSERT INTO account_deletion_requests
           (id, organization_id, user_id, reason, status, scheduled_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'pending', $4, NOW())
         RETURNING id, scheduled_at`, [orgId, userId, reason ?? null, scheduledAt.toISOString()]);
        const deletionReq = reqResult.rows[0];
        // Cancel Stripe subscription immediately
        try {
            const orgResult = await (0, database_1.query)('SELECT stripe_subscription_id FROM organizations WHERE id = $1', [orgId]);
            const stripeSubId = orgResult.rows[0]?.stripe_subscription_id;
            if (stripeSubId) {
                const { stripe } = await Promise.resolve().then(() => __importStar(require('../config/stripe')));
                await stripe.subscriptions.cancel(stripeSubId);
                await (0, database_1.query)(`UPDATE organizations SET subscription_status = 'cancelled', updated_at = NOW() WHERE id = $1`, [orgId]);
            }
        }
        catch (stripeErr) {
            console.error('[account] Failed to cancel Stripe subscription:', stripeErr.message);
        }
        // Create notification
        try {
            await (0, database_1.query)(`INSERT INTO notifications (id, organization_id, user_id, type, title, message, created_at)
           VALUES (gen_random_uuid(), $1, $2, 'account_deletion_scheduled', $3, $4, NOW())`, [
                orgId, userId,
                'Account Deletion Scheduled',
                `Your account is scheduled for deletion on ${scheduledAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. You can cancel this from Settings > Data & Privacy.`,
            ]);
        }
        catch (notifErr) {
            console.error('[account] Failed to create notification:', notifErr.message);
        }
        res.status(201).json({ id: deletionReq.id, scheduledAt: deletionReq.scheduled_at, status: 'pending' });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/account/delete/cancel
// Cancel a pending deletion request (within grace period)
router.post('/delete/cancel', async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const result = await (0, database_1.query)(`SELECT id, scheduled_at FROM account_deletion_requests
         WHERE organization_id = $1 AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1`, [orgId]);
        const deletionReq = result.rows[0];
        if (!deletionReq) {
            throw new errorHandler_1.AppError(404, 'No pending deletion request found', 'NOT_FOUND');
        }
        if (new Date(deletionReq.scheduled_at) < new Date()) {
            throw new errorHandler_1.AppError(400, 'Deletion grace period has expired', 'GRACE_PERIOD_EXPIRED');
        }
        await (0, database_1.query)(`UPDATE account_deletion_requests SET status = 'cancelled', completed_at = NOW() WHERE id = $1`, [deletionReq.id]);
        res.json({ status: 'cancelled', message: 'Account deletion cancelled successfully' });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/account/delete/confirm
// Immediately delete everything — no grace period
router.post('/delete/confirm', (0, validate_1.validate)(confirmDeleteSchema), async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const userId = req.user.userId;
        const { password } = req.body;
        // Verify password
        const userResult = await (0, database_1.query)('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        if (!user)
            throw new errorHandler_1.AppError(404, 'User not found', 'NOT_FOUND');
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!passwordMatch)
            throw new errorHandler_1.AppError(401, 'Invalid password', 'INVALID_PASSWORD');
        await performAccountDeletion(orgId);
        res.json({ deleted: true });
    }
    catch (err) {
        next(err);
    }
});
/**
 * Performs the full account deletion in a transaction.
 * Order matters — foreign key constraints must be respected.
 */
async function performAccountDeletion(orgId) {
    const client = await (0, database_1.getClient)();
    try {
        await client.query('BEGIN');
        // 1. Cancel Stripe subscription if still active
        try {
            const orgResult = await client.query('SELECT stripe_subscription_id FROM organizations WHERE id = $1', [orgId]);
            const stripeSubId = orgResult.rows[0]?.stripe_subscription_id;
            if (stripeSubId) {
                const { stripe } = await Promise.resolve().then(() => __importStar(require('../config/stripe')));
                await stripe.subscriptions.cancel(stripeSubId).catch(() => null);
            }
        }
        catch {
            // Non-blocking — continue with deletion
        }
        // 2. Get all conversation IDs (needed to delete messages)
        const convsResult = await client.query('SELECT id FROM conversations WHERE organization_id = $1', [orgId]);
        const convIds = convsResult.rows.map((r) => r.id);
        // 3. Delete messages
        if (convIds.length > 0) {
            await client.query(`DELETE FROM messages WHERE conversation_id = ANY($1::uuid[])`, [convIds]);
        }
        // 4. Get all agent IDs
        const agentsResult = await client.query('SELECT id FROM agents WHERE organization_id = $1', [orgId]);
        const agentIds = agentsResult.rows.map((r) => r.id);
        // 5. Delete knowledge chunks
        if (agentIds.length > 0) {
            const kfResult = await client.query(`SELECT id FROM knowledge_files WHERE agent_id = ANY($1::uuid[])`, [agentIds]);
            const kfIds = kfResult.rows.map((r) => r.id);
            if (kfIds.length > 0) {
                await client.query(`DELETE FROM knowledge_chunks WHERE knowledge_file_id = ANY($1::uuid[])`, [kfIds]);
            }
        }
        // 6. Delete in dependency order
        await client.query('DELETE FROM conversations WHERE organization_id = $1', [orgId]);
        await client.query(agentIds.length > 0
            ? `DELETE FROM knowledge_files WHERE agent_id = ANY($1::uuid[])`
            : 'SELECT 1', agentIds.length > 0 ? [agentIds] : []);
        await client.query(agentIds.length > 0
            ? `DELETE FROM agent_tools WHERE agent_id = ANY($1::uuid[])`
            : 'SELECT 1', agentIds.length > 0 ? [agentIds] : []);
        await client.query(agentIds.length > 0
            ? `DELETE FROM agent_versions WHERE agent_id = ANY($1::uuid[])`
            : 'SELECT 1', agentIds.length > 0 ? [agentIds] : []);
        await client.query('DELETE FROM agents WHERE organization_id = $1', [orgId]);
        await client.query('DELETE FROM contacts WHERE organization_id = $1', [orgId]);
        // Delete calendars + appointments
        const calResult = await client.query('SELECT id FROM calendars WHERE organization_id = $1', [orgId]);
        const calIds = calResult.rows.map((r) => r.id);
        if (calIds.length > 0) {
            await client.query(`DELETE FROM appointments WHERE calendar_id = ANY($1::uuid[])`, [calIds]);
        }
        await client.query('DELETE FROM calendars WHERE organization_id = $1', [orgId]);
        // Delete user-related data
        const usersResult = await client.query('SELECT id FROM users WHERE organization_id = $1', [orgId]);
        const userIds = usersResult.rows.map((r) => r.id);
        if (userIds.length > 0) {
            await client.query(`DELETE FROM refresh_tokens WHERE user_id = ANY($1::uuid[])`, [userIds]);
            await client.query(`DELETE FROM backup_codes WHERE user_id = ANY($1::uuid[])`, [userIds]);
            await client.query(`DELETE FROM password_resets WHERE user_id = ANY($1::uuid[])`, [userIds]);
        }
        await client.query('DELETE FROM notifications WHERE organization_id = $1', [orgId]);
        await client.query('DELETE FROM billing_events WHERE organization_id = $1', [orgId]);
        await client.query('DELETE FROM data_export_requests WHERE organization_id = $1', [orgId]);
        await client.query('DELETE FROM account_deletion_requests WHERE organization_id = $1', [orgId]);
        // Sub-accounts
        await client.query(`DELETE FROM sub_accounts WHERE parent_org_id = $1 OR child_org_id = $1`, [orgId]);
        await client.query('DELETE FROM users WHERE organization_id = $1', [orgId]);
        await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
        await client.query('COMMIT');
        // Clean up export files
        try {
            const exportsDir = path_1.default.join(process.cwd(), 'uploads', 'exports');
            const files = fs_1.default.readdirSync(exportsDir);
            for (const file of files) {
                if (file.includes(orgId)) {
                    fs_1.default.unlinkSync(path_1.default.join(exportsDir, file));
                }
            }
        }
        catch {
            // Non-critical
        }
        console.log(`[account] Organization ${orgId} deleted successfully`);
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
exports.default = router;
//# sourceMappingURL=account.js.map