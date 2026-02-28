import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validateUUID } from '../middleware/validateUUID';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { query } from '../config/database';
import { scoringQueue } from '../config/queues';
import {
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
  getContactConversations,
  getContactTimeline,
  updateContactStage,
  exportContactsCSV,
} from '../services/contact.service';

const router = Router();
router.use(requireAuth, orgContext);

const updateContactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  funnel_stage: z.enum(['lead', 'opportunity', 'customer']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const updateStageSchema = z.object({
  stage: z.enum(['lead', 'opportunity', 'customer']),
});

// POST /contacts/export — must be before /:id routes
router.post(
  '/export',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const b = req.body as Record<string, unknown>;
      const csv = await exportContactsCSV(req.org!.id, {
        search: typeof b['search'] === 'string' ? b['search'] : undefined,
        agentId: typeof b['agentId'] === 'string' ? b['agentId'] : undefined,
        funnelStage: typeof b['funnelStage'] === 'string' ? b['funnelStage'] : undefined,
        scoreMin: typeof b['scoreMin'] === 'number' ? b['scoreMin'] : undefined,
        scoreMax: typeof b['scoreMax'] === 'number' ? b['scoreMax'] : undefined,
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
);

// GET /contacts
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = req.query as Record<string, string>;
      const result = await getContacts(req.org!.id, {
        search: q['search'],
        agentId: q['agentId'],
        funnelStage: q['stage'],
        scoreMin: q['scoreMin'] ? parseInt(q['scoreMin'], 10) : undefined,
        scoreMax: q['scoreMax'] ? parseInt(q['scoreMax'], 10) : undefined,
        sortBy: q['sort'],
        sortOrder: (q['order'] as 'asc' | 'desc') || 'desc',
        page: q['page'] ? parseInt(q['page'], 10) : 1,
        limit: q['limit'] ? parseInt(q['limit'], 10) : 20,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /contacts/:id
router.get(
  '/:id',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contact = await getContactById(req.org!.id, String(req.params['id']));
      if (!contact) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
      res.json({ contact });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /contacts/:id
router.put(
  '/:id',
  validateUUID('id'),
  validate(updateContactSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contact = await updateContact(req.org!.id, String(req.params['id']), req.body);
      if (!contact) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
      res.json({ contact });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /contacts/:id
router.delete(
  '/:id',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await deleteContact(req.org!.id, String(req.params['id']));
      if (!deleted) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// GET /contacts/:id/conversations
router.get(
  '/:id/conversations',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversations = await getContactConversations(
        req.org!.id,
        String(req.params['id'])
      );
      res.json({ conversations });
    } catch (err) {
      next(err);
    }
  }
);

// GET /contacts/:id/timeline
router.get(
  '/:id/timeline',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const events = await getContactTimeline(req.org!.id, String(req.params['id']));
      res.json({ events });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /contacts/:id/stage
router.put(
  '/:id/stage',
  validateUUID('id'),
  validate(updateStageSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { stage } = req.body as z.infer<typeof updateStageSchema>;
      const contact = await updateContactStage(req.org!.id, String(req.params['id']), stage);
      if (!contact) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
      res.json({ contact });
    } catch (err) {
      next(err);
    }
  }
);

// POST /contacts/:id/analyze — trigger AI scoring for the contact's last conversation
router.post(
  '/:id/analyze',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contactId = String(req.params['id']);
      const orgId = req.org!.id;

      const convResult = await query<{ id: string }>(
        `SELECT id FROM conversations
         WHERE contact_id = $1 AND organization_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [contactId, orgId]
      );
      const conversationId = convResult.rows[0]?.id;
      if (!conversationId) {
        throw new AppError(404, 'No conversation found for this contact', 'NO_CONVERSATION');
      }

      await scoringQueue.add(
        'score-conversation',
        { conversationId, organizationId: orgId, trigger: 'manual' },
        { priority: 1 }
      );

      res.json({ message: 'Analysis started', conversationId });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
