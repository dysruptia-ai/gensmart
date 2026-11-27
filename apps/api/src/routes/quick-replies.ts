import { Router, Request, Response, NextFunction } from 'express';
import { INBOX_LIMITS } from '@gensmart/shared';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validateUUID } from '../middleware/validateUUID';
import { requireRole } from '../middleware/requireRole';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  INBOX_ADMIN_ROLES,
  isUniqueViolation,
  quickReplyCreateSchema,
  quickReplyUpdateSchema,
} from '../services/inbox-annotations.service';

/**
 * Respuestas rápidas de la Bandeja (web-43). Todo el equipo las lee y las usa; solo owner y admin
 * las crean, editan y borran. Mismo middleware que /api/conversations.
 */
const router = Router();
router.use(requireAuth, orgContext);

interface QuickReplyRow {
  id: string;
  shortcut: string;
  body: string;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, shortcut, body, use_count, last_used_at, created_at, updated_at';

function toApi(row: QuickReplyRow) {
  return {
    id: row.id,
    shortcut: row.shortcut,
    body: row.body,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const shortcutTaken = () => new AppError(409, 'That shortcut already exists', 'shortcut_taken');

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const r = await query<QuickReplyRow>(
      `SELECT ${COLUMNS} FROM quick_replies WHERE organization_id = $1 ORDER BY use_count DESC, shortcut`,
      [req.org!.id]
    );
    res.json({ quickReplies: r.rows.map(toApi) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole(...INBOX_ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { shortcut, body } = quickReplyCreateSchema.parse(req.body);
    const count = await query<{ count: string }>('SELECT COUNT(*) AS count FROM quick_replies WHERE organization_id = $1', [req.org!.id]);
    if (parseInt(count.rows[0]?.count ?? '0', 10) >= INBOX_LIMITS.quickRepliesPerOrg) {
      throw new AppError(422, `At most ${INBOX_LIMITS.quickRepliesPerOrg} quick replies`, 'quick_replies_limit');
    }
    try {
      const r = await query<QuickReplyRow>(
        `INSERT INTO quick_replies (organization_id, shortcut, body, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4) RETURNING ${COLUMNS}`,
        [req.org!.id, shortcut, body, req.user!.userId]
      );
      res.status(201).json({ quickReply: toApi(r.rows[0]!) });
    } catch (err) {
      if (isUniqueViolation(err)) throw shortcutTaken();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validateUUID('id'), requireRole(...INBOX_ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { shortcut, body } = quickReplyUpdateSchema.parse(req.body);
    try {
      const r = await query<QuickReplyRow>(
        `UPDATE quick_replies
         SET shortcut = COALESCE($3, shortcut), body = COALESCE($4, body), updated_by = $5, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 RETURNING ${COLUMNS}`,
        [String(req.params['id']), req.org!.id, shortcut ?? null, body ?? null, req.user!.userId]
      );
      if (!r.rows[0]) throw new AppError(404, 'Quick reply not found', 'NOT_FOUND');
      res.json({ quickReply: toApi(r.rows[0]) });
    } catch (err) {
      if (isUniqueViolation(err)) throw shortcutTaken();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validateUUID('id'), requireRole(...INBOX_ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const r = await query('DELETE FROM quick_replies WHERE id = $1 AND organization_id = $2 RETURNING id', [
      String(req.params['id']),
      req.org!.id,
    ]);
    if (!r.rows[0]) throw new AppError(404, 'Quick reply not found', 'NOT_FOUND');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Se llama al insertar la respuesta en el compositor (no al enviar). Cualquier rol.
router.post('/:id/use', validateUUID('id'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const r = await query<{ use_count: number }>(
      `UPDATE quick_replies SET use_count = use_count + 1, last_used_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING use_count`,
      [String(req.params['id']), req.org!.id]
    );
    if (!r.rows[0]) throw new AppError(404, 'Quick reply not found', 'NOT_FOUND');
    res.json({ useCount: r.rows[0].use_count });
  } catch (err) {
    next(err);
  }
});

export default router;
