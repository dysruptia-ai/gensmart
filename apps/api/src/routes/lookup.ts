import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

/**
 * POST /api/lookup/plan
 * Public endpoint (no auth required) for testing Custom Function tool.
 * Receives an email and returns the user's organization plan info.
 */
router.post('/plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const result = await pool.query(
      `SELECT u.name, u.email, o.name as organization, o.plan, o.subscription_status,
              o.current_period_end,
              (SELECT COUNT(*) FROM agents WHERE organization_id = o.id) as agent_count,
              (SELECT COUNT(*) FROM contacts WHERE organization_id = o.id) as contact_count
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [email.trim()]
    );

    if (result.rows.length === 0) {
      res.json({
        found: false,
        message: `No account found for email: ${email}`
      });
      return;
    }

    const row = result.rows[0];
    res.json({
      found: true,
      data: {
        name: row.name,
        email: row.email,
        organization: row.organization,
        plan: row.plan,
        subscription_status: row.subscription_status,
        period_end: row.current_period_end,
        agent_count: Number(row.agent_count),
        contact_count: Number(row.contact_count),
      }
    });
  } catch (err) {
    console.error('[lookup/plan] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
