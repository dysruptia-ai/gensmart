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
import { ragQueue, scrapingQueue } from '../config/queues';
import { query } from '../config/database';

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
  type: z.enum(['scheduling', 'rag', 'custom_function', 'mcp']),
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

      // Enqueue RAG processing job
      const ragEnqueued = await ragQueue.add('process-file', {
        fileId: knowledgeFile.id,
        agentId,
        organizationId: req.org!.id,
      }).catch(async (err) => {
        console.error('[agents] Failed to enqueue RAG job:', err);
        await query(
          `UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
          ['Processing queue unavailable. Click reprocess to retry.', knowledgeFile.id]
        ).catch(() => {});
        return null;
      });

      console.log(`[agents] File ${knowledgeFile.id} uploaded, RAG job: ${ragEnqueued ? String(ragEnqueued.id) : 'FAILED'}`);
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

      // Enqueue scraping job
      const scrapeEnqueued = await scrapingQueue.add('scrape-url', {
        fileId: file.id,
        agentId,
        organizationId: req.org!.id,
        url,
      }).catch(async (err) => {
        console.error('[agents] Failed to enqueue scraping job:', err);
        await query(
          `UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
          ['Processing queue unavailable. Click reprocess to retry.', file.id]
        ).catch(() => {});
        return null;
      });

      console.log(`[agents] URL ${file.id} added, scraping job: ${scrapeEnqueued ? String(scrapeEnqueued.id) : 'FAILED'}`);
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

      // Re-enqueue appropriate processing job
      if (file.fileType === 'web') {
        await scrapingQueue.add('scrape-url', {
          fileId: file.id,
          agentId: String(req.params['id']),
          organizationId: req.org!.id,
          url: file.sourceUrl ?? '',
        }).catch(async (err) => {
          console.error('[agents] Failed to re-enqueue scraping job:', err);
          await query(
            `UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
            ['Processing queue unavailable. Try again later.', file.id]
          ).catch(() => {});
        });
      } else {
        await ragQueue.add('process-file', {
          fileId: file.id,
          agentId: String(req.params['id']),
          organizationId: req.org!.id,
        }).catch(async (err) => {
          console.error('[agents] Failed to re-enqueue RAG job:', err);
          await query(
            `UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
            ['Processing queue unavailable. Try again later.', file.id]
          ).catch(() => {});
        });
      }

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

// POST /api/agents/:id/preview — Enhanced with tools, RAG, variable capture, persistent history
router.post(
  '/:id/preview',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['id']);
      const { message, systemPrompt } = req.body as {
        message: string;
        systemPrompt?: string;
      };

      if (!message?.trim()) {
        res.status(400).json({ error: { message: 'Message is required', code: 'MISSING_MESSAGE' } });
        return;
      }

      const { redis } = await import('../config/redis');
      const { chat } = await import('../services/llm.service');
      const {
        buildVariableCaptureInstructions,
        captureVariableToolDef,
      } = await import('../services/variable-capture.service');
      const { queryKnowledgeBase, hasKnowledgeBase } = await import('../services/rag.service');
      const { executeCustomFunction } = await import('../services/custom-function.service');

      // Fetch agent
      const agentResult = await agentService.getAgentById(req.org!.id, agentId);

      const previewKey = `preview:${agentId}:${req.user!.userId}`;
      const TTL = 30 * 60; // 30 minutes

      // Load stored history
      const rawHistory = await redis.get(previewKey);
      const history: { role: 'user' | 'assistant'; content: string }[] =
        rawHistory ? (JSON.parse(rawHistory) as { role: 'user' | 'assistant'; content: string }[]) : [];

      // Build system prompt
      const variables = Array.isArray(agentResult.variables) ? agentResult.variables : [];
      const variableInstructions = buildVariableCaptureInstructions(
        variables as Parameters<typeof buildVariableCaptureInstructions>[0]
      );
      let fullSystemPrompt = systemPrompt ?? agentResult.systemPrompt ?? '';
      if (variableInstructions) fullSystemPrompt += '\n\n' + variableInstructions;

      // RAG context
      const hasRAG = await hasKnowledgeBase(agentId);
      if (hasRAG) {
        const ragContext = await queryKnowledgeBase(agentId, message.trim());
        if (ragContext) fullSystemPrompt += '\n\n' + ragContext;
      }

      // Fetch tools
      const toolsResult = await query<{
        id: string;
        type: string;
        name: string;
        description: string | null;
        config: Record<string, unknown>;
        is_enabled: boolean;
      }>(
        'SELECT id, type, name, description, config, is_enabled FROM agent_tools WHERE agent_id = $1 AND is_enabled = true',
        [agentId]
      );

      const llmTools: Array<{ name: string; description: string; parameters: Record<string, unknown> }> = [];
      if (variables.length > 0) llmTools.push(captureVariableToolDef);

      for (const tool of toolsResult.rows) {
        if (tool.type === 'custom_function') {
          llmTools.push({
            name: tool.name.replace(/\s+/g, '_').toLowerCase(),
            description: tool.description ?? tool.name,
            parameters: (tool.config['parameters'] as Record<string, unknown>) ?? {
              type: 'object',
              properties: {},
              required: [],
            },
          });
        }
        if (tool.type === 'scheduling') {
          llmTools.push(
            {
              name: 'check_availability',
              description: 'Check available appointment slots for a given date. Use when the user wants to schedule or book an appointment.',
              parameters: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Date to check availability (YYYY-MM-DD)' },
                },
                required: ['date'],
              },
            },
            {
              name: 'book_appointment',
              description: 'Book an appointment at a specific date and time. Use after the user confirms a slot.',
              parameters: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'Appointment date (YYYY-MM-DD)' },
                  time: { type: 'string', description: 'Appointment start time (HH:MM)' },
                  name: { type: 'string', description: 'Name of the person booking' },
                },
                required: ['date', 'time'],
              },
            }
          );
        }
      }

      // Add scheduling instructions to system prompt if a scheduling tool is enabled
      if (toolsResult.rows.some((t) => t.type === 'scheduling')) {
        fullSystemPrompt += '\n\nYou have access to a scheduling system. When the user wants to book an appointment:\n1. First call check_availability with the requested date to see available time slots\n2. Present the available slots to the user\n3. When the user confirms a slot, call book_appointment with the date, time, and the user\'s name';
      }

      // LLM call
      const startTime = Date.now();
      let capturedVars: Record<string, string> = {};
      const toolsCalledLog: string[] = [];
      let finalResponse = '';
      let totalTokens = 0;

      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        ...history,
        { role: 'user', content: message.trim() },
      ];

      let currentMessages = [...messages];
      const maxIter = 5;

      for (let i = 0; i < maxIter; i++) {
        const planLimits = PLAN_LIMITS[req.org!.plan as PlanKey];
        const response = await chat({
          provider: agentResult.llmProvider as 'openai' | 'anthropic',
          model: agentResult.llmModel,
          system: fullSystemPrompt,
          messages: currentMessages,
          tools: llmTools.length > 0 ? llmTools : undefined,
          temperature: agentResult.temperature,
          maxTokens: Math.min(agentResult.maxTokens, planLimits?.maxTokensPerResponse ?? 512),
        });

        totalTokens += response.usage.totalTokens;

        if (!response.toolCalls?.length) {
          finalResponse = response.content;
          break;
        }

        for (const tc of response.toolCalls) {
          toolsCalledLog.push(tc.name);
          if (tc.name === 'capture_variable') {
            const name = String(tc.arguments['variable_name'] ?? '');
            const val = String(tc.arguments['variable_value'] ?? '');
            capturedVars[name] = val;
            currentMessages.push({ role: 'user', content: `[Tool result]: Variable '${name}' captured: ${val}` });
          } else if (tc.name === 'check_availability') {
            const { getAvailableSlots } = await import('../services/calendar.service');
            const date = String(tc.arguments['date'] ?? '');
            const schedulingTool = toolsResult.rows.find((t) => t.type === 'scheduling');
            const calendarId = schedulingTool ? String(schedulingTool.config['calendar_id'] ?? '') : '';
            let slotResult = 'No calendar configured for this agent.';
            if (calendarId && date) {
              try {
                const slots = await getAvailableSlots(calendarId, date);
                slotResult = slots.length
                  ? `Available slots for ${date}: ${slots.map((s) => s.start).join(', ')}. Which time works best?`
                  : `No available slots for ${date}. Please try another date.`;
              } catch {
                slotResult = `Could not check availability for ${date}.`;
              }
            }
            currentMessages.push({ role: 'user', content: `[Tool result for check_availability]: ${slotResult}` });
          } else if (tc.name === 'book_appointment') {
            const { createAppointment } = await import('../services/appointment.service');
            const { localTimeToUTC } = await import('../services/calendar.service');
            const date = String(tc.arguments['date'] ?? '');
            const time = String(tc.arguments['time'] ?? '');
            const personName = String(tc.arguments['name'] ?? 'Guest');
            const schedulingTool = toolsResult.rows.find((t) => t.type === 'scheduling');
            const calendarId = schedulingTool ? String(schedulingTool.config['calendar_id'] ?? '') : '';
            let bookResult = 'Could not book appointment — missing information.';
            if (calendarId && date && time) {
              try {
                const calResult = await query<{ slot_duration: number; timezone: string }>(
                  'SELECT slot_duration, timezone FROM calendars WHERE id = $1',
                  [calendarId]
                );
                const slotDuration = calResult.rows[0]?.slot_duration ?? 30;
                const calTz = calResult.rows[0]?.timezone || 'UTC';
                const startUTC = localTimeToUTC(date, time, calTz);
                const startTime = startUTC.toISOString();
                const endTime = new Date(startUTC.getTime() + slotDuration * 60000).toISOString();
                await createAppointment(req.org!.id, {
                  calendarId,
                  contactId: null,
                  title: `Appointment — ${personName}`,
                  startTime,
                  endTime,
                });
                bookResult = `Appointment confirmed for ${date} at ${time} for ${personName}.`;
              } catch (err) {
                bookResult = `Could not book appointment: ${(err as Error).message}`;
              }
            }
            currentMessages.push({ role: 'user', content: `[Tool result for book_appointment]: ${bookResult}` });
          } else {
            const toolDef = toolsResult.rows.find(
              (t) => t.name.replace(/\s+/g, '_').toLowerCase() === tc.name
            );
            if (toolDef) {
              const result = await executeCustomFunction(
                toolDef.config as unknown as Parameters<typeof executeCustomFunction>[0],
                tc.arguments
              );
              currentMessages.push({ role: 'user', content: `[Tool result for ${tc.name}]: ${result}` });
            }
          }
        }

        if (response.content.trim()) finalResponse = response.content;
      }

      if (!finalResponse.trim()) finalResponse = '...';

      // Persist updated history
      const updatedHistory = [
        ...history,
        { role: 'user' as const, content: message.trim() },
        { role: 'assistant' as const, content: finalResponse },
      ];
      await redis.set(previewKey, JSON.stringify(updatedHistory), 'EX', TTL);

      const latencyMs = Date.now() - startTime;

      res.json({
        message: finalResponse,
        metadata: {
          tokensUsed: totalTokens,
          toolsCalled: toolsCalledLog,
          capturedVariables: capturedVars,
          latencyMs,
          model: agentResult.llmModel,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/agents/:id/preview/reset
router.post(
  '/:id/preview/reset',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = String(req.params['id']);
      const { redis } = await import('../config/redis');
      const previewKey = `preview:${agentId}:${req.user!.userId}`;
      await redis.del(previewKey);
      res.json({ message: 'Preview history cleared' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
