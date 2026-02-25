import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import { validateUUID } from '../middleware/validateUUID';
import * as agentService from '../services/agent.service';
import { agentCreateSchema, agentUpdateSchema } from '@gensmart/shared';

const router = Router();

router.use(requireAuth, orgContext);

const toolSchema = z.object({
  type: z.enum(['scheduling', 'rag', 'web_scraping', 'custom_function', 'mcp']),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  config: z.record(z.unknown()),
});

const toolUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  config: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});

// GET /api/agents/templates — must be before /:id routes
router.get(
  '/templates',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templates = await agentService.getTemplates();
      res.json({ templates });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/generate-prompt
router.post(
  '/generate-prompt',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { description, language = 'en' } = req.body as {
        description: string;
        language?: string;
      };
      if (!description || String(description).trim().length < 10) {
        res.status(400).json({
          error: { message: 'Description must be at least 10 characters', code: 'INVALID_INPUT' },
        });
        return;
      }
      const { generatePrompt } = await import('../services/llm.service');
      const result = await generatePrompt(String(description).trim(), String(language));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/from-template/:templateId — must be before /:id routes
router.post(
  '/from-template/:templateId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agent = await agentService.createFromTemplate(
        req.org!.id,
        req.org!.plan,
        String(req.params['templateId'])
      );
      res.status(201).json({ agent });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/agents
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, status, channel, page, limit } = req.query as Record<string, string>;
      const result = await agentService.getAgents(req.org!.id, {
        search,
        status,
        channel,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents
router.post(
  '/',
  validate(agentCreateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agent = await agentService.createAgent(req.org!.id, req.org!.plan, req.body);
      res.status(201).json({ agent });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/agents/:id/tools
router.get(
  '/:id/tools',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tools = await agentService.getTools(req.org!.id, String(req.params['id']));
      res.json({ tools });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/:id/tools
router.post(
  '/:id/tools',
  validateUUID('id'),
  validate(toolSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tool = await agentService.createTool(
        req.org!.id,
        String(req.params['id']),
        req.body
      );
      res.status(201).json({ tool });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/agents/:id/tools/:toolId
router.put(
  '/:id/tools/:toolId',
  validateUUID('id', 'toolId'),
  validate(toolUpdateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tool = await agentService.updateTool(
        req.org!.id,
        String(req.params['id']),
        String(req.params['toolId']),
        req.body
      );
      res.json({ tool });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/agents/:id/tools/:toolId
router.delete(
  '/:id/tools/:toolId',
  validateUUID('id', 'toolId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await agentService.deleteTool(
        req.org!.id,
        String(req.params['id']),
        String(req.params['toolId'])
      );
      res.json({ message: 'Tool deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/:id/duplicate — must be before /:id routes
router.post(
  '/:id/duplicate',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agent = await agentService.duplicateAgent(
        req.org!.id,
        String(req.params['id']),
        req.org!.plan
      );
      res.status(201).json({ agent });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/agents/:id
router.get(
  '/:id',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agent = await agentService.getAgentById(req.org!.id, String(req.params['id']));
      res.json({ agent });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/agents/:id
router.put(
  '/:id',
  validateUUID('id'),
  validate(agentUpdateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agent = await agentService.updateAgent(
        req.org!.id,
        String(req.params['id']),
        req.body
      );
      res.json({ agent });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/agents/:id
router.delete(
  '/:id',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await agentService.deleteAgent(req.org!.id, String(req.params['id']));
      res.json({ message: 'Agent deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/:id/publish
router.post(
  '/:id/publish',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await agentService.publishAgent(
        req.org!.id,
        String(req.params['id']),
        req.user!.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/agents/:id/versions
router.get(
  '/:id/versions',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const versions = await agentService.getVersions(req.org!.id, String(req.params['id']));
      res.json({ versions });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/:id/rollback/:versionId
router.post(
  '/:id/rollback/:versionId',
  validateUUID('id', 'versionId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agent = await agentService.rollbackAgent(
        req.org!.id,
        String(req.params['id']),
        String(req.params['versionId'])
      );
      res.json({ agent });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
