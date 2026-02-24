import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.json({ message: 'Funnel - Phase 6' }));
router.get('/stats', (_req, res) => res.json({ message: 'Funnel stats - Phase 6' }));
router.put('/move', (_req, res) => res.json({ message: 'Move funnel card - Phase 6' }));

export default router;
