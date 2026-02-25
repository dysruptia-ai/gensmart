import { Router } from 'express';
import { validateUUID } from '../middleware/validateUUID';

const router = Router();

router.get('/', (_req, res) => res.json({ message: 'Contacts - Phase 6' }));
router.get('/:id', validateUUID('id'), (_req, res) => res.json({ message: 'Get contact - Phase 6' }));
router.put('/:id', validateUUID('id'), (_req, res) => res.json({ message: 'Update contact - Phase 6' }));
router.delete('/:id', validateUUID('id'), (_req, res) => res.json({ message: 'Delete contact - Phase 6' }));

export default router;
