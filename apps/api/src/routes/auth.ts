import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { registerSchema, loginSchema } from '@gensmart/shared';
import { query } from '../config/database';

const router = Router();

const authLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 10, keyPrefix: 'auth' });

const verify2FASchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().min(6).max(8),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const enable2FASchema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6),
});

const disable2FASchema = z.object({
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  language: z.enum(['en', 'es']).optional(),
  name: z.string().min(1).max(255).optional(),
});

function setRefreshCookie(res: Response, token: string): void {
  const isProduction = process.env['NODE_ENV'] === 'production';
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
    ...(isProduction && { domain: '.gensmart.co' }),
  });
}

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await authService.register(req.body);
      setRefreshCookie(res, tokens.refreshToken);
      res.status(201).json({
        accessToken: tokens.accessToken,
        user: tokens.user,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(req.body);

      if ('requires2FA' in result) {
        res.json({ requires2FA: true, tempToken: result.tempToken });
        return;
      }

      setRefreshCookie(res, result.refreshToken);
      res.json({ accessToken: result.accessToken, user: result.user });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
      if (!refreshToken) {
        res.status(401).json({ error: { message: 'No refresh token', code: 'NO_REFRESH_TOKEN' } });
        return;
      }

      const tokens = await authService.refreshToken(refreshToken);
      setRefreshCookie(res, tokens.refreshToken);
      res.json({ accessToken: tokens.accessToken, user: tokens.user });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      const isProduction = process.env['NODE_ENV'] === 'production';
      res.clearCookie('refresh_token', {
        path: '/',
        ...(isProduction && { domain: '.gensmart.co' }),
      });
      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.forgotPassword(req.body.email);
      res.json({ message: 'If an account exists with that email, we sent a reset link.' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.resetPassword(req.body);
      res.json({ message: 'Password reset successfully' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/2fa/setup',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.setup2FA(req.user!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/2fa/enable',
  requireAuth,
  validate(enable2FASchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.enable2FA(req.user!.userId, req.body.secret, req.body.code);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/2fa/disable',
  requireAuth,
  validate(disable2FASchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.disable2FA(req.user!.userId, req.body.password);
      res.json({ message: '2FA disabled successfully' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/2fa/verify',
  authLimiter,
  validate(verify2FASchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await authService.verify2FA(req.body);
      setRefreshCookie(res, tokens.refreshToken);
      res.json({ accessToken: tokens.accessToken, user: tokens.user });
    } catch (err) {
      next(err);
    }
  }
);

// Update current user preferences (language, name)
router.put(
  '/me',
  requireAuth,
  validate(updateMeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { language, name } = req.body as z.infer<typeof updateMeSchema>;
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (language !== undefined) {
        sets.push(`language = $${idx++}`);
        params.push(language);
      }
      if (name !== undefined) {
        sets.push(`name = $${idx++}`);
        params.push(name);
      }

      if (sets.length === 0) {
        res.json({ message: 'No changes' });
        return;
      }

      sets.push(`updated_at = NOW()`);
      params.push(req.user!.userId);

      await query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`,
        params
      );

      res.json({ message: 'Profile updated' });
    } catch (err) {
      next(err);
    }
  }
);

// Update onboarding progress
const onboardingSchema = z.object({
  step: z.number().int().min(0).max(10).optional(),
  completed: z.boolean().optional(),
  editorTourCompleted: z.boolean().optional(),
});

router.put(
  '/onboarding',
  requireAuth,
  validate(onboardingSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { step, completed, editorTourCompleted } = req.body as z.infer<typeof onboardingSchema>;
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (completed === true) {
        sets.push(`onboarding_completed = TRUE`);
        sets.push(`onboarding_step = 0`);
      } else {
        if (completed === false) {
          sets.push(`onboarding_completed = FALSE`);
        }
        if (step !== undefined) {
          sets.push(`onboarding_step = $${idx++}`);
          params.push(step);
        }
      }

      if (editorTourCompleted === true) {
        sets.push(`editor_tour_completed = TRUE`);
      } else if (editorTourCompleted === false) {
        sets.push(`editor_tour_completed = FALSE`);
      }

      if (sets.length === 0) {
        res.json({ success: true });
        return;
      }

      sets.push(`updated_at = NOW()`);
      params.push(req.user!.userId);

      await query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`,
        params
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
