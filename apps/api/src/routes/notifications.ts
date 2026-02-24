import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.json({ message: 'Notifications - Phase 9' }));
router.get('/unread-count', (_req, res) => res.json({ count: 0 }));
router.put('/:id/read', (_req, res) => res.json({ message: 'Mark read - Phase 9' }));
router.put('/read-all', (_req, res) => res.json({ message: 'Mark all read - Phase 9' }));

export default router;
