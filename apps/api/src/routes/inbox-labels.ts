import { Router, Request, Response, NextFunction } from 'express';
import { INBOX_LIMITS } from '@gensmart/shared';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validateUUID } from '../middleware/validateUUID';
import { requireRole } from '../middleware/requireRole';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { INBOX_ADMIN_ROLES, emitInbox, isUniqueViolation, labelNameSchema } from '../services/inbox-annotations.service';

/**
 * Catálogo de etiquetas de la Bandeja (web-43). Van en la conversación, no en el contacto.
 * Todo el equipo las lee; owner y admin crean, renombran y borran. Aplicarlas: PUT /api/conversations/:id/labels.
 */
const router = Router();
router.use(requireAuth, orgContext);

interface LabelRow {
  id: string;
  name: string;
  conversation_count: string | number;
}

function toApi(row: LabelRow) {
  return { id: row.id, name: row.name, conversationCount: Number(row.conversation_count) };
}

const labelTaken = () => new AppError(409, 'A label with that name already exists', 'label_taken');

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const r = await query<LabelRow>(
      `SELECT l.id, l.name,
              (SELECT COUNT(*) FROM conversation_labels cl WHERE cl.label_id = l.id) AS conversation_count
       FROM inbox_labels l
       WHERE l.organization_id = $1
       ORDER BY lower(l.name), l.id`,
      [req.org!.id]
    );
    res.json({ labels: r.rows.map(toApi) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole(...INBOX_ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = labelNameSchema.parse(req.body);
    const count = await query<{ count: string }>('SELECT COUNT(*) AS count FROM inbox_labels WHERE organization_id = $1', [req.org!.id]);
    if (parseInt(count.rows[0]?.count ?? '0', 10) >= INBOX_LIMITS.labelsPerOrg) {
      throw new AppError(422, `At most ${INBOX_LIMITS.labelsPerOrg} labels`, 'labels_limit');
    }
    try {
      const r = await query<LabelRow>(
        `INSERT INTO inbox_labels (organization_id, name, created_by) VALUES ($1, $2, $3)
         RETURNING id, name, 0 AS conversation_count`,
        [req.org!.id, name, req.user!.userId]
      );
      res.status(201).json({ label: toApi(r.rows[0]!) });
    } catch (err) {
      if (isUniqueViolation(err)) throw labelTaken();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validateUUID('id'), requireRole(...INBOX_ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = labelNameSchema.parse(req.body);
    try {
      const r = await query<LabelRow>(
        `UPDATE inbox_labels l SET name = $3, updated_at = NOW()
         WHERE l.id = $1 AND l.organization_id = $2
         RETURNING l.id, l.name, (SELECT COUNT(*) FROM conversation_labels cl WHERE cl.label_id = l.id) AS conversation_count`,
        [String(req.params['id']), req.org!.id, name]
      );
      if (!r.rows[0]) throw new AppError(404, 'Label not found', 'NOT_FOUND');
      const label = toApi(r.rows[0]);
      emitInbox(req.org!.id, 'inbox-labels:changed', { action: 'renamed', label: { id: label.id, name: label.name } });
      res.json({ label });
    } catch (err) {
      if (isUniqueViolation(err)) throw labelTaken();
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// Borrar la quita de todas sus conversaciones (CASCADE); las conversaciones no se tocan.
router.delete('/:id', validateUUID('id'), requireRole(...INBOX_ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params['id']);
    const r = await query('DELETE FROM inbox_labels WHERE id = $1 AND organization_id = $2 RETURNING id', [id, req.org!.id]);
    if (!r.rows[0]) throw new AppError(404, 'Label not found', 'NOT_FOUND');
    emitInbox(req.org!.id, 'inbox-labels:changed', { action: 'deleted', labelId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
