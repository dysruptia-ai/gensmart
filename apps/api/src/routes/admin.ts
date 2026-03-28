import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/superAdmin';
import { validate } from '../middleware/validate';
import { query } from '../config/database';
import * as platformSettings from '../services/platform-settings.service';

const router = Router();

// All admin routes require auth + super admin
router.use(requireAuth);
router.use(requireSuperAdmin);

// ─── Platform Settings ───────────────────────────────────────

// GET /api/admin/settings — List all platform settings (masked)
router.get(
  '/settings',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await platformSettings.getAllSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/settings/:key — Get single setting
router.get(
  '/settings/:key',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const setting = await platformSettings.getSetting(String(req.params['key']));
      if (!setting) {
        res.status(404).json({ error: { message: 'Setting not found', code: 'NOT_FOUND' } });
        return;
      }
      res.json(setting);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/admin/settings/:key — Update setting value
const updateSettingSchema = z.object({
  value: z.string(),
});

router.put(
  '/settings/:key',
  validate(updateSettingSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await platformSettings.setSettingValue(
        String(req.params['key']),
        req.body.value,
        req.user!.userId
      );
      res.json({ message: 'Setting updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/settings/test-whatsapp — Test WhatsApp token validity
router.post(
  '/settings/test-whatsapp',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = await platformSettings.getWhatsAppToken();
      if (!token) {
        res.json({ valid: false, error: 'No WhatsApp token configured' });
        return;
      }
      const result = await platformSettings.testWhatsAppToken(token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Organizations Management ────────────────────────────────

// GET /api/admin/organizations — List all orgs
router.get(
  '/organizations',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const search = (req.query['search'] as string) || '';
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
      const offset = (page - 1) * limit;

      let whereClause = '';
      const params: unknown[] = [];
      let paramIdx = 1;

      if (search) {
        whereClause = `WHERE o.name ILIKE $${paramIdx} OR EXISTS (
          SELECT 1 FROM users u2 WHERE u2.organization_id = o.id AND u2.email ILIKE $${paramIdx}
        )`;
        params.push(`%${search}%`);
        paramIdx++;
      }

      const countResult = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT o.id) as count FROM organizations o ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.count || '0');

      const orgsResult = await query<{
        id: string;
        name: string;
        slug: string;
        plan: string;
        subscription_status: string;
        created_at: string;
        agents_count: string;
        users_count: string;
        trial_ends_at: string | null;
      }>(
        `SELECT
          o.id, o.name, o.slug, o.plan, o.subscription_status, o.created_at, o.trial_ends_at,
          (SELECT COUNT(*) FROM agents a WHERE a.organization_id = o.id)::text as agents_count,
          (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id)::text as users_count
        FROM organizations o
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      );

      // Get current month message usage for each org
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const orgIds = orgsResult.rows.map((o) => o.id);

      let usageMap: Record<string, number> = {};
      if (orgIds.length > 0) {
        const usageResult = await query<{ organization_id: string; total: string }>(
          `SELECT organization_id, SUM(value)::text as total
           FROM usage_logs
           WHERE organization_id = ANY($1) AND metric = 'messages' AND period >= $2::date
           GROUP BY organization_id`,
          [orgIds, `${period}-01`]
        );
        usageMap = Object.fromEntries(
          usageResult.rows.map((r) => [r.organization_id, parseInt(r.total)])
        );
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
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/organizations/:id — Org detail
router.get(
  '/organizations/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = String(req.params['id']);

      const orgResult = await query<{
        id: string;
        name: string;
        slug: string;
        plan: string;
        subscription_status: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        current_period_start: string | null;
        current_period_end: string | null;
        trial_ends_at: string | null;
        settings: Record<string, unknown>;
        created_at: string;
      }>(
        `SELECT id, name, slug, plan, subscription_status, stripe_customer_id,
                stripe_subscription_id, current_period_start, current_period_end,
                trial_ends_at, settings, created_at
         FROM organizations WHERE id = $1`,
        [orgId]
      );

      if (orgResult.rows.length === 0) {
        res.status(404).json({ error: { message: 'Organization not found', code: 'NOT_FOUND' } });
        return;
      }

      const org = orgResult.rows[0]!;

      // Users
      const usersResult = await query<{
        id: string;
        email: string;
        name: string;
        role: string;
        totp_enabled: boolean;
        last_login_at: string | null;
        created_at: string;
      }>(
        `SELECT id, email, name, role, totp_enabled, last_login_at, created_at
         FROM users WHERE organization_id = $1 ORDER BY created_at`,
        [orgId]
      );

      // Agents
      const agentsResult = await query<{
        id: string;
        name: string;
        status: string;
        llm_provider: string;
        llm_model: string;
        channels: unknown;
        created_at: string;
      }>(
        `SELECT id, name, status, llm_provider, llm_model, channels, created_at
         FROM agents WHERE organization_id = $1 ORDER BY created_at DESC`,
        [orgId]
      );

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
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/admin/organizations/:id/plan — Change org plan manually
const changePlanSchema = z.object({
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
});

router.put(
  '/organizations/:id/plan',
  validate(changePlanSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = String(req.params['id']);
      await query(
        'UPDATE organizations SET plan = $1, updated_at = NOW() WHERE id = $2',
        [req.body.plan, orgId]
      );
      res.json({ message: `Plan updated to ${req.body.plan as string}` });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/admin/organizations/:id/reset-2fa — Reset 2FA for a user
const reset2FASchema = z.object({
  userId: z.string().uuid(),
});

router.post(
  '/organizations/:id/reset-2fa',
  validate(reset2FASchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.body as { userId: string };
      const orgId = String(req.params['id']);

      // Verify user belongs to this org
      const userCheck = await query<{ id: string }>(
        'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
        [userId, orgId]
      );

      if (userCheck.rows.length === 0) {
        res.status(404).json({ error: { message: 'User not found in this organization', code: 'NOT_FOUND' } });
        return;
      }

      // Reset 2FA
      await query(
        `UPDATE users SET totp_enabled = FALSE, totp_secret_encrypted = NULL, updated_at = NOW() WHERE id = $1`,
        [userId]
      );

      // Delete backup codes
      await query('DELETE FROM backup_codes WHERE user_id = $1', [userId]);

      res.json({ message: '2FA reset successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Platform Dashboard ──────────────────────────────────────

// GET /api/admin/dashboard/stats — Platform-wide metrics
router.get(
  '/dashboard/stats',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [orgsCount, agentsCount, activeAgents, usersCount] = await Promise.all([
        query<{ count: string }>('SELECT COUNT(*) as count FROM organizations'),
        query<{ count: string }>('SELECT COUNT(*) as count FROM agents'),
        query<{ count: string }>("SELECT COUNT(*) as count FROM agents WHERE status = 'active'"),
        query<{ count: string }>('SELECT COUNT(*) as count FROM users'),
      ]);

      // Messages today
      const today = new Date().toISOString().split('T')[0];
      const msgsToday = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM messages WHERE created_at >= $1::date`,
        [today]
      );

      // Messages this month
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const msgsMonth = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM messages WHERE created_at >= $1::date`,
        [monthStart]
      );

      // Conversations today
      const convsToday = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations WHERE created_at >= $1::date`,
        [today]
      );

      // Plans breakdown
      const planBreakdown = await query<{ plan: string; count: string }>(
        `SELECT plan, COUNT(*) as count FROM organizations GROUP BY plan ORDER BY count DESC`
      );

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
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/dashboard/usage-chart — Messages over time
router.get(
  '/dashboard/usage-chart',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = parseInt(req.query['days'] as string) || 30;
      const safeDays = Math.min(days, 90);

      const result = await query<{ date: string; count: string }>(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM messages
         WHERE created_at >= NOW() - $1::integer * INTERVAL '1 day'
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [safeDays]
      );

      res.json(
        result.rows.map((r) => ({
          date: r.date,
          messages: parseInt(r.count),
        }))
      );
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/dashboard/recent-signups — Last 10 signups
router.get(
  '/dashboard/recent-signups',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await query<{
        id: string;
        name: string;
        plan: string;
        created_at: string;
      }>(
        'SELECT id, name, plan, created_at FROM organizations ORDER BY created_at DESC LIMIT 10'
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
