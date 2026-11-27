import { Router, Request, Response, NextFunction } from 'express';
import { INBOX_LIMITS } from '@gensmart/shared';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validateUUID } from '../middleware/validateUUID';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { isUniqueViolation } from '../services/inbox-annotations.service';
import { getOrgTimezone } from '../services/conversation-events.service';
import { emitToUser } from '../services/inbox-reads.service';
import {
  type ViewFilters,
  countForView,
  mapLimit,
  pruneFilters,
  viewCreateSchema,
  viewFiltersSchema,
  viewUpdateSchema,
} from '../services/inbox-views.service';

/**
 * Vistas guardadas de la Bandeja (web-44). Todo es solo de quien llama: la vista de otra persona
 * responde 404 (no 403), también para owner y admin. El agente no las usa.
 */
const router = Router();
router.use(requireAuth, orgContext);

interface ViewRow {
  id: string;
  name: string;
  filters: unknown;
  position: number;
}

/** Cuántos contadores se calculan a la vez (son 20 vistas como máximo). */
const COUNT_CONCURRENCY = 4;

const nameTaken = () => new AppError(409, 'You already have a view with that name', 'view_name_taken');

function emitChanged(userId: string, organizationId: string): void {
  emitToUser(userId, 'inbox-views:changed', { organizationId });
}

/** Lee los criterios guardados; si algo no valida (dato viejo), la vista queda sin criterios. */
function readFilters(raw: unknown): ViewFilters {
  const parsed = viewFiltersSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

async function toApi(row: ViewRow, ctx: { orgId: string; userId: string; timezone: string | null }) {
  const pruned = await pruneFilters(ctx.orgId, readFilters(row.filters));
  if (pruned.changed) {
    await query('UPDATE inbox_views SET filters = $2, updated_at = NOW() WHERE id = $1', [row.id, JSON.stringify(pruned.filters)]);
  }
  return { id: row.id, name: row.name, filters: pruned.filters, count: await countForView(pruned.filters, ctx) };
}

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const r = await query<ViewRow>(
      `SELECT id, name, filters, position FROM inbox_views
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY position, created_at, id
       LIMIT $3`,
      [req.org!.id, req.user!.userId, INBOX_LIMITS.savedViewsPerUser]
    );
    const ctx = { orgId: req.org!.id, userId: req.user!.userId, timezone: await getOrgTimezone(req.org!.id) };
    const views = await mapLimit(r.rows, COUNT_CONCURRENCY, (row) => toApi(row, ctx));
    res.json({ views });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, filters } = viewCreateSchema.parse(req.body);
    const me = req.user!.userId;
    const count = await query<{ count: string; max_position: number | null }>(
      'SELECT COUNT(*) AS count, MAX(position) AS max_position FROM inbox_views WHERE organization_id = $1 AND user_id = $2',
      [req.org!.id, me]
    );
    if (parseInt(count.rows[0]?.count ?? '0', 10) >= INBOX_LIMITS.savedViewsPerUser) {
      throw new AppError(422, `At most ${INBOX_LIMITS.savedViewsPerUser} saved views`, 'view_limit');
    }
    let row: ViewRow;
    try {
      const r = await query<ViewRow>(
        `INSERT INTO inbox_views (organization_id, user_id, name, filters, position)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, filters, position`,
        [req.org!.id, me, name, JSON.stringify(filters), (count.rows[0]?.max_position ?? -1) + 1]
      );
      row = r.rows[0]!;
    } catch (err) {
      if (isUniqueViolation(err)) throw nameTaken();
      throw err;
    }
    emitChanged(me, req.org!.id);
    const ctx = { orgId: req.org!.id, userId: me, timezone: await getOrgTimezone(req.org!.id) };
    res.status(201).json({ view: await toApi(row, ctx) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validateUUID('id'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = viewUpdateSchema.parse(req.body);
    const me = req.user!.userId;
    let row: ViewRow | undefined;
    try {
      const r = await query<ViewRow>(
        `UPDATE inbox_views SET
           name = COALESCE($4, name),
           filters = COALESCE($5::jsonb, filters),
           position = COALESCE($6, position),
           updated_at = NOW()
         WHERE id = $1 AND organization_id = $2 AND user_id = $3
         RETURNING id, name, filters, position`,
        [
          String(req.params['id']),
          req.org!.id,
          me,
          body.name ?? null,
          body.filters ? JSON.stringify(body.filters) : null,
          body.position ?? null,
        ]
      );
      row = r.rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) throw nameTaken();
      throw err;
    }
    if (!row) throw new AppError(404, 'View not found', 'NOT_FOUND');
    emitChanged(me, req.org!.id);
    const ctx = { orgId: req.org!.id, userId: me, timezone: await getOrgTimezone(req.org!.id) };
    res.json({ view: await toApi(row, ctx) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validateUUID('id'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const r = await query('DELETE FROM inbox_views WHERE id = $1 AND organization_id = $2 AND user_id = $3 RETURNING id', [
      String(req.params['id']),
      req.org!.id,
      req.user!.userId,
    ]);
    if ((r.rowCount ?? 0) === 0) throw new AppError(404, 'View not found', 'NOT_FOUND');
    emitChanged(req.user!.userId, req.org!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
