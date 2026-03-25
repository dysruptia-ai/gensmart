import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

const router = Router();

interface PromoCodeRow {
  id: string;
  code: string;
  plan: string;
  duration_days: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
}

// GET /api/promo/validate?code=XXXX — public endpoint (no auth required)
router.get(
  '/validate',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = String(req.query['code'] ?? '').toUpperCase().trim();
      if (!code) {
        res.json({ valid: false, reason: 'No code provided' });
        return;
      }

      const result = await query<PromoCodeRow>(
        `SELECT id, code, plan, duration_days, max_uses, used_count, is_active, expires_at
         FROM promo_codes WHERE code = $1`,
        [code]
      );
      const promo = result.rows[0];

      if (!promo) {
        res.json({ valid: false, reason: 'Code not found' });
        return;
      }

      if (!promo.is_active) {
        res.json({ valid: false, reason: 'Code is no longer active' });
        return;
      }

      if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
        res.json({ valid: false, reason: 'Code has reached its usage limit' });
        return;
      }

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        res.json({ valid: false, reason: 'Code has expired' });
        return;
      }

      res.json({
        valid: true,
        plan: promo.plan,
        durationDays: promo.duration_days,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
