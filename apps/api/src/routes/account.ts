import { Router } from 'express';

const router = Router();

router.post('/export-data', (_req, res) => res.json({ message: 'Export data - Phase 10' }));
router.post('/delete', (_req, res) => res.json({ message: 'Delete account - Phase 10' }));

export default router;
