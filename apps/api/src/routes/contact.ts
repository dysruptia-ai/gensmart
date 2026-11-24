import { Router, Request, Response, NextFunction } from 'express';
import { sendEmail, emailTemplate } from '../config/email';
import { env } from '../config/env';
import { rateLimiter } from '../middleware/rateLimiter';
import { verifyTurnstileToken } from '../services/turnstile.service';
import { handleContactSales } from '../services/contact-sales.service';

const router = Router();

/** 5 submissions per IP every 15 minutes (the sales dialog and the /contacto page share it). */
export const CONTACT_RATE_LIMIT = { windowSeconds: 15 * 60, maxRequests: 5 } as const;

const contactLimiter = rateLimiter({
  ...CONTACT_RATE_LIMIT,
  keyPrefix: 'contact-sales',
  message: 'Too many messages. Please try again in a few minutes.',
});

// POST /api/contact-sales — public, no auth required
router.post(
  '/',
  contactLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await handleContactSales(req.body, req.ip, {
        turnstileConfigured: Boolean(env.TURNSTILE_SECRET_KEY),
        verifyTurnstile: verifyTurnstileToken,
        sendEmail,
        wrapHtml: emailTemplate,
      });
      res.status(result.status).json(result.body);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
