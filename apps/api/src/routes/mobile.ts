import { Router } from 'express';

const router = Router();

router.post('/auth/qr-generate', (_req, res) => res.json({ message: 'Mobile QR - Phase 11' }));
router.post('/auth/login', (_req, res) => res.json({ message: 'Mobile login - Phase 11' }));
router.get('/agents', (_req, res) => res.json({ message: 'Mobile agents - Phase 11' }));

export default router;
