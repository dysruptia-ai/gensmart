import fs from 'fs';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { query } from '../config/database';
import { exportQueue } from '../config/queues';
import { AppError } from '../middleware/errorHandler';
import { guardPasswordCheck } from '../services/attempt-limiter';
import { assertNoSubAccounts, performAccountDeletion } from '../services/account-deletion.service';

// Re-exported so existing imports of performAccountDeletion from this module keep working
export { performAccountDeletion };

const router = Router();

router.use(requireAuth, orgContext);

const deleteAccountSchema = z.object({
  password: z.string().min(1),
  reason: z.string().max(500).optional(),
});

const confirmDeleteSchema = z.object({
  password: z.string().min(1),
});

// ── DATA EXPORT ──────────────────────────────────────────────────────────────

// POST /api/account/export-data
// Request a new data export. Max 1 active export per org at a time.
router.post(
  '/export-data',
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;

      // Check for existing active export
      const existing = await query<{ id: string; status: string }>(
        `SELECT id, status FROM data_export_requests
         WHERE organization_id = $1 AND status IN ('queued', 'processing')
         ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );

      if (existing.rows.length > 0) {
        res.status(409).json({
          error: { message: 'An export is already being prepared', code: 'EXPORT_IN_PROGRESS' },
          exportRequest: existing.rows[0],
        });
        return;
      }

      // Create export request
      const result = await query<{ id: string }>(
        `INSERT INTO data_export_requests (id, organization_id, requested_by, status, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'queued', NOW())
         RETURNING id`,
        [orgId, userId]
      );
      const exportRequest = result.rows[0];

      // Enqueue the export job
      await exportQueue.add('export', {
        exportRequestId: exportRequest.id,
        organizationId: orgId,
      });

      res.status(201).json({ id: exportRequest.id, status: 'queued' });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/account/export-data/latest
// Get the latest export request for this org (for polling status)
router.get(
  '/export-data/latest',
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.orgId;

      const result = await query<{
        id: string;
        status: string;
        expires_at: string | null;
        created_at: string;
      }>(
        `SELECT id, status, expires_at, created_at
         FROM data_export_requests
         WHERE organization_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );

      if (!result.rows.length) {
        res.json(null);
        return;
      }

      const req_ = result.rows[0];

      // Mark as expired if past expires_at
      if (req_.status === 'completed' && req_.expires_at && new Date(req_.expires_at) < new Date()) {
        await query(
          `UPDATE data_export_requests SET status = 'expired' WHERE id = $1`,
          [req_.id]
        );
        req_.status = 'expired';
      }

      res.json(req_);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/account/export-data/:id
// Download the ZIP file if completed, or return status
router.get(
  '/export-data/:id',
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.orgId;
      const exportId = String(req.params['id']);

      const result = await query<{
        id: string;
        status: string;
        file_path: string | null;
        expires_at: string | null;
        created_at: string;
      }>(
        `SELECT id, status, file_path, expires_at, created_at
         FROM data_export_requests
         WHERE id = $1 AND organization_id = $2`,
        [exportId, orgId]
      );

      const exportReq = result.rows[0];
      if (!exportReq) {
        throw new AppError(404, 'Export not found', 'NOT_FOUND');
      }

      if (exportReq.status !== 'completed' || !exportReq.file_path) {
        res.json({ status: exportReq.status });
        return;
      }

      if (exportReq.expires_at && new Date(exportReq.expires_at) < new Date()) {
        await query(`UPDATE data_export_requests SET status = 'expired' WHERE id = $1`, [exportId]);
        throw new AppError(410, 'Export has expired', 'EXPORT_EXPIRED');
      }

      if (!fs.existsSync(exportReq.file_path)) {
        throw new AppError(404, 'Export file not found', 'FILE_NOT_FOUND');
      }

      const date = new Date(exportReq.created_at).toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="gensmart-export-${date}.zip"`);
      fs.createReadStream(exportReq.file_path).pipe(res);
    } catch (err) {
      next(err);
    }
  }
);

// ── ACCOUNT DELETION ─────────────────────────────────────────────────────────

// GET /api/account/delete/status
// Check if there is a pending deletion request
router.get(
  '/delete/status',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.orgId;

      const result = await query<{
        id: string;
        status: string;
        scheduled_at: string;
        reason: string | null;
      }>(
        `SELECT id, status, scheduled_at, reason
         FROM account_deletion_requests
         WHERE organization_id = $1 AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );

      res.json(result.rows[0] ?? null);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/account/delete
// Schedule account deletion (30-day grace period)
router.post(
  '/delete',
  requireRole('owner'),
  validate(deleteAccountSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const { password, reason } = req.body as z.infer<typeof deleteAccountSchema>;

      // Verify password
      const userResult = await query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];
      if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

      const passwordMatch = await guardPasswordCheck(userId, () => bcrypt.compare(password, user.password_hash));
      if (!passwordMatch) throw new AppError(401, 'Invalid password', 'INVALID_PASSWORD');

      // A parent with sub-accounts cannot be scheduled for deletion
      await assertNoSubAccounts(orgId);

      // Check for existing pending request
      const existing = await query<{ id: string }>(
        `SELECT id FROM account_deletion_requests
         WHERE organization_id = $1 AND status = 'pending'`,
        [orgId]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({
          error: { message: 'A deletion request is already pending', code: 'DELETION_PENDING' },
        });
        return;
      }

      const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const reqResult = await query<{ id: string; scheduled_at: string }>(
        `INSERT INTO account_deletion_requests
           (id, organization_id, user_id, reason, status, scheduled_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'pending', $4, NOW())
         RETURNING id, scheduled_at`,
        [orgId, userId, reason ?? null, scheduledAt.toISOString()]
      );
      const deletionReq = reqResult.rows[0];

      // Cancel Stripe subscription immediately
      try {
        const orgResult = await query<{ stripe_subscription_id: string | null }>(
          'SELECT stripe_subscription_id FROM organizations WHERE id = $1',
          [orgId]
        );
        const stripeSubId = orgResult.rows[0]?.stripe_subscription_id;
        if (stripeSubId) {
          const { stripe } = await import('../config/stripe');
          await stripe.subscriptions.cancel(stripeSubId);
          await query(
            `UPDATE organizations SET subscription_status = 'cancelled', updated_at = NOW() WHERE id = $1`,
            [orgId]
          );
        }
      } catch (stripeErr) {
        console.error('[account] Failed to cancel Stripe subscription:', (stripeErr as Error).message);
      }

      // Create notification
      try {
        await query(
          `INSERT INTO notifications (id, organization_id, user_id, type, title, message, created_at)
           VALUES (gen_random_uuid(), $1, $2, 'account_deletion_scheduled', $3, $4, NOW())`,
          [
            orgId, userId,
            'Account Deletion Scheduled',
            `Your account is scheduled for deletion on ${scheduledAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. You can cancel this from Settings > Data & Privacy.`,
          ]
        );
      } catch (notifErr) {
        console.error('[account] Failed to create notification:', (notifErr as Error).message);
      }

      res.status(201).json({ id: deletionReq.id, scheduledAt: deletionReq.scheduled_at, status: 'pending' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/account/delete/cancel
// Cancel a pending deletion request (within grace period)
router.post(
  '/delete/cancel',
  requireRole('owner'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.orgId;

      const result = await query<{ id: string; scheduled_at: string }>(
        `SELECT id, scheduled_at FROM account_deletion_requests
         WHERE organization_id = $1 AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );
      const deletionReq = result.rows[0];

      if (!deletionReq) {
        throw new AppError(404, 'No pending deletion request found', 'NOT_FOUND');
      }

      if (new Date(deletionReq.scheduled_at) < new Date()) {
        throw new AppError(400, 'Deletion grace period has expired', 'GRACE_PERIOD_EXPIRED');
      }

      await query(
        `UPDATE account_deletion_requests SET status = 'cancelled', completed_at = NOW() WHERE id = $1`,
        [deletionReq.id]
      );

      res.json({ status: 'cancelled', message: 'Account deletion cancelled successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/account/delete/confirm
// Immediately delete everything — no grace period
router.post(
  '/delete/confirm',
  requireRole('owner'),
  validate(confirmDeleteSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const { password } = req.body as z.infer<typeof confirmDeleteSchema>;

      // Verify password
      const userResult = await query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];
      if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

      const passwordMatch = await guardPasswordCheck(userId, () => bcrypt.compare(password, user.password_hash));
      if (!passwordMatch) throw new AppError(401, 'Invalid password', 'INVALID_PASSWORD');

      await assertNoSubAccounts(orgId);
      await performAccountDeletion(orgId);

      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
