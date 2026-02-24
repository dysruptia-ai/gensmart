import { Router } from 'express';

const router = Router();

router.get('/:agentId/config', (_req, res) => res.json({ message: 'Widget config - Phase 5' }));
router.post('/:agentId/session', (_req, res) => res.json({ message: 'Widget session - Phase 5' }));
router.post('/:agentId/message', (_req, res) => res.json({ message: 'Widget message - Phase 5' }));

export default router;
