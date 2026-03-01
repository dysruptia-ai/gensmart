import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import { query } from '../config/database';
import { encrypt, decrypt } from '../config/encryption';
import { PLAN_LIMITS } from '@gensmart/shared';
import { AppError } from '../middleware/errorHandler';
import * as orgService from '../services/organization.service';
import * as subAccountService from '../services/sub-account.service';

type PlanKey = keyof typeof PLAN_LIMITS;

const router = Router();

// All org routes require auth
router.use(requireAuth, orgContext);

const updateOrgSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  settings: z.record(z.unknown()).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

const createSubAccountSchema = z.object({
  name: z.string().min(2).max(255),
  label: z.string().min(1).max(100),
});

const apiKeysSchema = z.object({
  openai_key: z.string().max(200).optional(),
  anthropic_key: z.string().max(200).optional(),
});

// ── Organization ──
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const org = await orgService.getOrganization(req.user!.orgId);
    res.json(org);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/',
  validate(updateOrgSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await orgService.updateOrganization(req.user!.orgId, req.body);
      res.json(org);
    } catch (err) {
      next(err);
    }
  }
);

// ── Members ──
router.get('/members', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const members = await orgService.getMembers(req.user!.orgId);
    res.json(members);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/members/invite',
  validate(inviteMemberSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await orgService.inviteMember(req.user!.orgId, req.user!.userId, req.body);
      res.status(201).json({ message: 'Invitation sent' });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/members/:userId/role',
  validate(updateRoleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await orgService.updateMemberRole(
        req.user!.orgId,
        req.user!.userId,
        String(req.params['userId']),
        req.body.role
      );
      res.json({ message: 'Role updated' });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/members/:userId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await orgService.removeMember(req.user!.orgId, req.user!.userId, String(req.params['userId']));
      res.json({ message: 'Member removed' });
    } catch (err) {
      next(err);
    }
  }
);

// ── BYO API Keys (Enterprise only) ──
router.get('/api-keys', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plan = (req.org?.plan ?? 'free') as PlanKey;
    if (!PLAN_LIMITS[plan]?.byoApiKey) {
      throw new AppError(403, 'BYO API Keys require Enterprise plan', 'PLAN_LIMIT_REACHED');
    }

    const result = await query<{
      byo_openai_key_encrypted: string | null;
      byo_anthropic_key_encrypted: string | null;
    }>(
      'SELECT byo_openai_key_encrypted, byo_anthropic_key_encrypted FROM organizations WHERE id = $1',
      [req.user!.orgId]
    );
    const org = result.rows[0];

    // Return masked keys (last 4 chars only)
    const maskKey = (encrypted: string | null): string | null => {
      if (!encrypted) return null;
      try {
        const raw = decrypt(encrypted);
        return `****${raw.slice(-4)}`;
      } catch {
        return null;
      }
    };

    res.json({
      openai_key: maskKey(org?.byo_openai_key_encrypted ?? null),
      anthropic_key: maskKey(org?.byo_anthropic_key_encrypted ?? null),
      hasOpenaiKey: Boolean(org?.byo_openai_key_encrypted),
      hasAnthropicKey: Boolean(org?.byo_anthropic_key_encrypted),
    });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/api-keys',
  validate(apiKeysSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = (req.org?.plan ?? 'free') as PlanKey;
      if (!PLAN_LIMITS[plan]?.byoApiKey) {
        throw new AppError(403, 'BYO API Keys require Enterprise plan', 'PLAN_LIMIT_REACHED');
      }

      const { openai_key, anthropic_key } = req.body as z.infer<typeof apiKeysSchema>;

      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (openai_key !== undefined) {
        updates.push(`byo_openai_key_encrypted = $${idx++}`);
        values.push(openai_key ? encrypt(openai_key) : null);
      }
      if (anthropic_key !== undefined) {
        updates.push(`byo_anthropic_key_encrypted = $${idx++}`);
        values.push(anthropic_key ? encrypt(anthropic_key) : null);
      }

      if (updates.length === 0) {
        res.json({ message: 'No changes' });
        return;
      }

      updates.push(`updated_at = NOW()`);
      values.push(req.user!.orgId);

      await query(
        `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );

      res.json({ message: 'API keys updated' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/organization/api-keys/test — verify a key works
router.post(
  '/api-keys/test',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = (req.org?.plan ?? 'free') as PlanKey;
      if (!PLAN_LIMITS[plan]?.byoApiKey) {
        throw new AppError(403, 'BYO API Keys require Enterprise plan', 'PLAN_LIMIT_REACHED');
      }

      const { type, key } = req.body as { type: 'openai' | 'anthropic'; key?: string };

      // If no key provided, decrypt the stored key
      let testKey = key;
      if (!testKey) {
        const result = await query<{
          byo_openai_key_encrypted: string | null;
          byo_anthropic_key_encrypted: string | null;
        }>(
          'SELECT byo_openai_key_encrypted, byo_anthropic_key_encrypted FROM organizations WHERE id = $1',
          [req.user!.orgId]
        );
        const org = result.rows[0];
        const encrypted = type === 'openai'
          ? org?.byo_openai_key_encrypted
          : org?.byo_anthropic_key_encrypted;
        if (!encrypted) {
          throw new AppError(400, 'No key configured', 'NO_KEY');
        }
        testKey = decrypt(encrypted);
      }

      // Test the key with a minimal API call
      if (type === 'openai') {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: testKey });
        await client.models.list();
      } else {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: testKey });
        await client.models.list();
      }

      res.json({ valid: true });
    } catch (err) {
      if ((err as { status?: number })?.status === 401 || (err as { message?: string })?.message?.includes('Invalid API key')) {
        res.status(400).json({ error: { message: 'Invalid API key', code: 'INVALID_KEY' } });
        return;
      }
      next(err);
    }
  }
);

// ── Sub-accounts ──
router.get('/sub-accounts', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const subAccounts = await subAccountService.getSubAccounts(req.user!.orgId);
    res.json(subAccounts);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/sub-accounts',
  validate(createSubAccountSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subAccount = await subAccountService.createSubAccount(req.user!.orgId, req.body);
      res.status(201).json(subAccount);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/sub-accounts/:childOrgId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await subAccountService.removeSubAccount(req.user!.orgId, String(req.params['childOrgId']));
      res.json({ message: 'Sub-account removed' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/sub-accounts/:childOrgId/switch',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await subAccountService.switchToSubAccount(
        req.user!.userId,
        req.user!.email,
        req.user!.role,
        req.user!.orgId,
        String(req.params['childOrgId'])
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
