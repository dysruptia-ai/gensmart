import { Router } from 'express';

const router = Router();

router.get('/:agentId', (_req, res) => res.json({ message: 'Knowledge base - Phase 4' }));
router.post('/:agentId', (_req, res) => res.json({ message: 'Upload knowledge - Phase 4' }));

export default router;
