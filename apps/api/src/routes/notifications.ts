import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from '../services/notification.service';

const router = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const uuidSchema = z.string().uuid();

// GET /api/notifications
router.get(
  '/',
  requireAuth,
  orgContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: { message: 'Invalid query params', details: parsed.error.flatten() } });
        return;
      }
      const { limit, offset } = parsed.data;
      const userId = req.user!.userId;
      const orgId = req.user!.orgId;
      const result = await listNotifications(userId, orgId, { limit, offset });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/notifications/unread-count
router.get(
  '/unread-count',
  requireAuth,
  orgContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await getUnreadCount(req.user!.userId, req.user!.orgId);
      res.json({ count });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/notifications/read-all
router.put(
  '/read-all',
  requireAuth,
  orgContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await markAllAsRead(req.user!.userId, req.user!.orgId);
      res.json({ updated });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/notifications/:id/read
router.put(
  '/:id/read',
  requireAuth,
  orgContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idParse = uuidSchema.safeParse(String(req.params['id']));
      if (!idParse.success) {
        res.status(400).json({ error: { message: 'Invalid notification ID' } });
        return;
      }
      await markAsRead(idParse.data, req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
