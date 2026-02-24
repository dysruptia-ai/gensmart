import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.json({ message: 'Agents list - Phase 3' }));
router.post('/', (_req, res) => res.json({ message: 'Create agent - Phase 3' }));
router.get('/templates', (_req, res) => res.json({ message: 'Agent templates - Phase 3' }));
router.post('/generate-prompt', (_req, res) => res.json({ message: 'Generate prompt - Phase 3' }));
router.get('/:id', (_req, res) => res.json({ message: 'Get agent - Phase 3' }));
router.put('/:id', (_req, res) => res.json({ message: 'Update agent - Phase 3' }));
router.delete('/:id', (_req, res) => res.json({ message: 'Delete agent - Phase 3' }));
router.post('/:id/publish', (_req, res) => res.json({ message: 'Publish agent - Phase 3' }));
router.get('/:id/versions', (_req, res) => res.json({ message: 'Agent versions - Phase 3' }));
router.post('/:id/preview', (_req, res) => res.json({ message: 'Preview agent - Phase 3' }));

export default router;
