import { Router } from 'express';

const router = Router();

router.get('/webhook', (_req, res) => res.json({ message: 'WhatsApp webhook verify - Phase 5' }));
router.post('/webhook', (_req, res) => res.json({ message: 'WhatsApp webhook - Phase 5' }));
router.post('/connect', (_req, res) => res.json({ message: 'WhatsApp connect - Phase 5' }));

export default router;
