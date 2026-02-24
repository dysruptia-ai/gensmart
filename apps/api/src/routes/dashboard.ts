import { Router } from 'express';

const router = Router();

router.get('/stats', (_req, res) => res.json({ message: 'Dashboard stats - Phase 9' }));
router.get('/leads-chart', (_req, res) => res.json({ message: 'Leads chart - Phase 9' }));
router.get('/top-agents', (_req, res) => res.json({ message: 'Top agents - Phase 9' }));
router.get('/funnel-overview', (_req, res) => res.json({ message: 'Funnel overview - Phase 9' }));

export default router;
