import { Router } from 'express';

const router = Router();

router.post('/create-checkout', (_req, res) => res.json({ message: 'Create checkout - Phase 8' }));
router.post('/create-portal', (_req, res) => res.json({ message: 'Create portal - Phase 8' }));
router.get('/subscription', (_req, res) => res.json({ message: 'Subscription - Phase 8' }));
router.post('/webhook', (_req, res) => res.json({ message: 'Webhook - Phase 8' }));

export default router;
