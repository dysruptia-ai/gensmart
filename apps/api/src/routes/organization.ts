import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import * as orgService from '../services/organization.service';
import * as subAccountService from '../services/sub-account.service';

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
