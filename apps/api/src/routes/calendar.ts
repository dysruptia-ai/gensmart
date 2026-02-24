import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.json({ message: 'Calendars - Phase 7' }));
router.post('/', (_req, res) => res.json({ message: 'Create calendar - Phase 7' }));

export default router;
