import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.json({ message: 'Organization - Phase 1' }));
router.put('/', (_req, res) => res.json({ message: 'Update organization - Phase 1' }));
router.get('/members', (_req, res) => res.json({ message: 'Members - Phase 1' }));
router.post('/members/invite', (_req, res) => res.json({ message: 'Invite member - Phase 1' }));

export default router;
