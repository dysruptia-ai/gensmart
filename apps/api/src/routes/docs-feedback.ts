import { createHash } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { sendEmail, emailTemplate } from '../config/email';
import { rateLimiter } from '../middleware/rateLimiter';
import { handleDocsFeedback } from '../services/docs-feedback.service';

const router = Router();

/**
 * 10 ratings per IP every 15 minutes. The Redis counter is keyed by a hash of the IP
 * (not the IP itself) and expires with the window: nothing else about the sender is kept.
 */
export const DOCS_FEEDBACK_RATE_LIMIT = { windowSeconds: 15 * 60, maxRequests: 10 } as const;

const docsFeedbackLimiter = rateLimiter({
  ...DOCS_FEEDBACK_RATE_LIMIT,
  keyPrefix: 'docs-feedback',
  keyFn: (req) => createHash('sha256').update(req.ip ?? req.socket.remoteAddress ?? 'unknown').digest('hex').slice(0, 32),
  message: 'Too many ratings. Please try again in a few minutes.',
});

// POST /api/docs-feedback — public, no auth required
router.post('/', docsFeedbackLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await handleDocsFeedback(req.body, { sendEmail, wrapHtml: emailTemplate });
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

export default router;
