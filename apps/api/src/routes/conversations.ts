import { Router } from 'express';
import { validateUUID } from '../middleware/validateUUID';

const router = Router();

router.get('/', (_req, res) => res.json({ message: 'Conversations - Phase 4' }));
router.get('/:id', validateUUID('id'), (_req, res) => res.json({ message: 'Get conversation - Phase 4' }));
router.post('/:id/takeover', validateUUID('id'), (_req, res) => res.json({ message: 'Takeover - Phase 4' }));
router.post('/:id/release', validateUUID('id'), (_req, res) => res.json({ message: 'Release - Phase 4' }));
router.post('/:id/message', validateUUID('id'), (_req, res) => res.json({ message: 'Send message - Phase 4' }));
router.put('/:id/close', validateUUID('id'), (_req, res) => res.json({ message: 'Close conversation - Phase 4' }));

export default router;
