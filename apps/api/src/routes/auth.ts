import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { registerSchema, loginSchema } from '@gensmart/shared';

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

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
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
      res.clearCookie('refresh_token', { path: '/' });
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

export default router;
