import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import { validateUUID } from '../middleware/validateUUID';
import * as agentService from '../services/agent.service';
import { agentCreateSchema, agentUpdateSchema, PLAN_LIMITS } from '@gensmart/shared';

const router = Router();

router.use(requireAuth, orgContext);

type PlanKey = keyof typeof PLAN_LIMITS;

// ── Multer setup ──────────────────────────────────────────────────────────────

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadsDir, 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const knowledgeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadsDir, 'knowledge');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
    } else {
      cb(null, true);
    }
  },
});

const uploadKnowledge = multer({
  storage: knowledgeStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      cb(new Error('Only PDF, DOCX, TXT, MD files are allowed'));
    } else {
      cb(null, true);
    }
  },
});

// ── Schemas ───────────────────────────────────────────────────────────────────

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

// POST /api/agents/:id/tools — with plan enforcement
router.post(
  '/:id/tools',
  validateUUID('id'),
  validate(toolSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['id']);
      const plan = req.org!.plan as PlanKey;
      const planLimits = PLAN_LIMITS[plan];
      const toolType: string = req.body.type;

      // Enforce plan limits for custom_function
      if (toolType === 'custom_function') {
        const limit = planLimits?.customFunctions ?? 0;
        if (limit === 0) {
          res.status(403).json({
            error: { message: 'Custom functions are not available in your plan. Upgrade to Starter or above.', code: 'PLAN_LIMIT_REACHED' },
          });
          return;
        }
        if (limit !== Infinity) {
          const currentCount = await agentService.countToolsByType(agentId, 'custom_function');
          if (currentCount >= limit) {
            res.status(403).json({
              error: { message: `Custom function limit reached (${limit}). Upgrade your plan to add more.`, code: 'PLAN_LIMIT_REACHED' },
            });
            return;
          }
        }
      }

      // Enforce plan limits for mcp
      if (toolType === 'mcp') {
        const limit = planLimits?.mcpServers ?? 0;
        if (limit === 0) {
          res.status(403).json({
            error: { message: 'MCP servers are not available in your plan. Upgrade to Pro or above.', code: 'PLAN_LIMIT_REACHED' },
          });
          return;
        }
        if (limit !== Infinity) {
          const currentCount = await agentService.countToolsByType(agentId, 'mcp');
          if (currentCount >= limit) {
            res.status(403).json({
              error: { message: `MCP server limit reached (${limit}). Upgrade your plan to add more.`, code: 'PLAN_LIMIT_REACHED' },
            });
            return;
          }
        }
      }

      const tool = await agentService.createTool(req.org!.id, agentId, req.body);
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

// POST /api/agents/:id/tools/:toolId/test
router.post(
  '/:id/tools/:toolId/test',
  validateUUID('id', 'toolId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await agentService.testTool(
        req.org!.id,
        String(req.params['id']),
        String(req.params['toolId']),
        (req.body as { params?: Record<string, unknown> }).params ?? {}
      );
      res.json(result);
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

// POST /api/agents/:id/avatar
router.post(
  '/:id/avatar',
  validateUUID('id'),
  uploadAvatar.single('avatar'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: { message: 'No file uploaded', code: 'MISSING_FILE' } });
        return;
      }
      const apiBase = process.env['API_BASE_URL'] ?? 'http://localhost:4000';
      const avatarUrl = `${apiBase}/uploads/avatars/${file.filename}`;
      const agent = await agentService.updateAgent(req.org!.id, String(req.params['id']), {
        avatarUrl,
      });
      res.json({ avatarUrl: agent.avatarUrl });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/agents/:id/knowledge
router.get(
  '/:id/knowledge',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = await agentService.getKnowledgeFiles(req.org!.id, String(req.params['id']));
      res.json({ files });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/:id/knowledge (file upload)
router.post(
  '/:id/knowledge',
  validateUUID('id'),
  uploadKnowledge.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['id']);
      const plan = req.org!.plan as PlanKey;
      const planLimits = PLAN_LIMITS[plan];
      const fileLimit = planLimits?.knowledgeFiles ?? 1;

      // Check file limit
      const existingFiles = await agentService.getKnowledgeFiles(req.org!.id, agentId);
      if (fileLimit !== Infinity && existingFiles.length >= fileLimit) {
        res.status(403).json({
          error: { message: `File limit reached (${fileLimit}). Upgrade your plan to add more.`, code: 'PLAN_LIMIT_REACHED' },
        });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: { message: 'No file uploaded', code: 'MISSING_FILE' } });
        return;
      }

      const ext = path.extname(file.originalname).toLowerCase().slice(1);
      const knowledgeFile = await agentService.createKnowledgeFile(req.org!.id, agentId, {
        filename: file.originalname,
        fileType: ext,
        filePath: file.path,
        fileSize: file.size,
      });
      res.status(201).json({ file: knowledgeFile });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/:id/knowledge/web
router.post(
  '/:id/knowledge/web',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['id']);
      const { url } = req.body as { url?: string };
      if (!url) {
        res.status(400).json({ error: { message: 'URL is required', code: 'MISSING_URL' } });
        return;
      }
      // Validate URL
      try {
        new URL(url);
      } catch {
        res.status(400).json({ error: { message: 'Invalid URL format', code: 'INVALID_URL' } });
        return;
      }

      const plan = req.org!.plan as PlanKey;
      const planLimits = PLAN_LIMITS[plan];
      const fileLimit = planLimits?.knowledgeFiles ?? 1;
      const existingFiles = await agentService.getKnowledgeFiles(req.org!.id, agentId);
      if (fileLimit !== Infinity && existingFiles.length >= fileLimit) {
        res.status(403).json({
          error: { message: `File limit reached (${fileLimit}). Upgrade your plan to add more.`, code: 'PLAN_LIMIT_REACHED' },
        });
        return;
      }

      const file = await agentService.createKnowledgeFileFromUrl(req.org!.id, agentId, url);
      res.status(201).json({ file });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/:id/knowledge/:fileId/reprocess
router.post(
  '/:id/knowledge/:fileId/reprocess',
  validateUUID('id', 'fileId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await agentService.reprocessKnowledgeFile(
        req.org!.id,
        String(req.params['id']),
        String(req.params['fileId'])
      );
      res.json({ file });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/agents/:id/knowledge/:fileId
router.delete(
  '/:id/knowledge/:fileId',
  validateUUID('id', 'fileId'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await agentService.deleteKnowledgeFile(
        req.org!.id,
        String(req.params['id']),
        String(req.params['fileId'])
      );
      res.json({ message: 'File deleted successfully' });
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
      // Plan enforcement for maxTokens and contextWindowMessages
      const plan = req.org!.plan as PlanKey;
      const planLimits = PLAN_LIMITS[plan];
      const body = req.body as Record<string, unknown>;

      if (planLimits && typeof body['maxTokens'] === 'number') {
        body['maxTokens'] = Math.min(body['maxTokens'] as number, planLimits.maxTokensPerResponse);
      }
      if (planLimits && typeof body['contextWindowMessages'] === 'number') {
        body['contextWindowMessages'] = Math.min(body['contextWindowMessages'] as number, planLimits.contextWindowMessages);
      }

      const agent = await agentService.updateAgent(req.org!.id, String(req.params['id']), body);
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

// POST /api/agents/:id/preview
router.post(
  '/:id/preview',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { message, history = [], systemPrompt } = req.body as {
        message: string;
        history?: { role: string; content: string }[];
        systemPrompt?: string;
      };
      if (!message || !message.trim()) {
        res.status(400).json({ error: { message: 'Message is required', code: 'MISSING_MESSAGE' } });
        return;
      }
      const result = await agentService.previewAgent(
        req.org!.id,
        String(req.params['id']),
        message.trim(),
        history,
        systemPrompt
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
