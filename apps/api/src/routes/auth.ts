import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rateLimiter } from '../middleware/rateLimiter';
import { verifyTurnstileToken } from '../services/turnstile.service';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { registerSchema, loginSchema, userLanguageSchema } from '@gensmart/shared';
import { resolveUserLanguage } from '../utils/language';
import { query } from '../config/database';
import { env } from '../config/env';
import { requireTrustedOrigin } from '../middleware/trustedOrigin';
import { computeAllowedOrigins } from '../utils/cors-origins';
import { signupRefSchema } from '@gensmart/shared';
import { getOAuthProvider } from '../services/oauth/registry';
import { OAuthVerificationError } from '../services/oauth/types';
import * as socialAuth from '../services/social-auth.service';

const router = Router();

const authLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 10, keyPrefix: 'auth' });
// Registration is far stricter than login: a real user rarely needs more than 1-2 attempts per hour
const registerLimiter = rateLimiter({
  windowSeconds: 3600,
  maxRequests: 3,
  keyPrefix: 'auth-register',
  failClosed: true,
});
// refresh and logout are cookie-authenticated: a per-IP limit plus an Origin check against CSRF
const sessionCookieLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 60, keyPrefix: 'auth-session' });
const trustedOrigin = requireTrustedOrigin(computeAllowedOrigins(env.FRONTEND_URL));
// 2FA management: per user (these routes run after requireAuth)
const twoFactorManageLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 10,
  keyPrefix: 'auth-2fa-manage',
  keyFn: (req) => req.user?.userId ?? null,
});

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
  language: userLanguageSchema.optional(),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const orgAccessConsumeSchema = z.object({
  token: z.string().min(1),
  language: userLanguageSchema.optional(),
});

const orgAccessResendParamsSchema = z.object({
  token: z.string().min(1),
});

// Per-org throttle lives in authService.resendOrgAccessEmail (Redis SET NX,
// keyed by organization_id — several stale tokens for the same org share the
// same 5-min window). This IP limiter is coarse defense-in-depth on top of
// that, not the actual anti-abuse mechanism the task asked for.
const orgAccessResendLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 5, keyPrefix: 'org-access-resend' });

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
  registerLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const captchaOk = await verifyTurnstileToken(req.body.turnstileToken, req.ip);
      if (!captchaOk) {
        res.status(400).json({
          error: { message: 'Captcha verification failed. Please try again.', code: 'CAPTCHA_FAILED' },
        });
        return;
      }

      const result = await authService.register({ ...req.body, language: resolveUserLanguage(req.body.language, req) });
      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account before logging in.',
        email: result.email,
        promoApplied: result.promoApplied,
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
      const result = await authService.login({ ...req.body, ip: req.ip });

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
  sessionCookieLimiter,
  trustedOrigin,
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

// Read-only session check: used by the web app's Node-runtime /admin layout to gate the
// panel server-side. Deliberately does NOT call authService.refreshToken — that rotates and
// marks the token used, which would desync the browser's cookie (never updated by this
// server-to-server call) from the backend's record and trip reuse detection on the next
// real refresh, logging the user out.
router.get(
  '/session-check',
  sessionCookieLimiter,
  trustedOrigin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
      if (!refreshToken) {
        res.status(401).json({ error: { message: 'No refresh token', code: 'NO_REFRESH_TOKEN' } });
        return;
      }
      const user = await authService.verifySession(refreshToken);
      res.json({ user: { isSuperAdmin: user.isSuperAdmin } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/logout',
  sessionCookieLimiter,
  trustedOrigin,
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
  '/verify-email',
  authLimiter,
  validate(verifyEmailSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.consumeEmailVerificationToken(req.body.token);
      res.json({ message: 'Email verified successfully' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/resend-verification',
  authLimiter,
  validate(resendVerificationSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.resendVerificationEmail(req.body.email);
    } catch (err) {
      next(err);
      return;
    }
    res.json({ message: 'If an unverified account exists with that email, we resent the verification link.' });
  }
);

router.post(
  '/org-access/consume',
  authLimiter,
  validate(orgAccessConsumeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.consumeOrgAccessToken(req.body.token, req.body.language);

      // Users with 2FA finish the sign-in at /auth/2fa/verify, exactly like a password login
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

// Deliberately always returns the same generic success message and always
// 200, whether the token id matched a row, the org rate limit was already
// hit, or the user is no longer a member — see authService.resendOrgAccessEmail
// for why (this endpoint must never leak whether a given token/org exists).
router.post(
  '/org-access/:token/resend',
  orgAccessResendLimiter,
  validate(orgAccessResendParamsSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.resendOrgAccessEmail(req.params['token'] as string);
    } catch (err) {
      next(err);
      return;
    }
    res.json({ message: 'If this link corresponds to a valid account, we resent access to it.' });
  }
);

router.post(
  '/2fa/setup',
  requireAuth,
  twoFactorManageLimiter,
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
  twoFactorManageLimiter,
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
  twoFactorManageLimiter,
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

// ---------- Ingreso y registro con proveedores (web-38) ----------

const OAUTH_STATE_COOKIE = 'gs_oauth_state';
const oauthLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 20, keyPrefix: 'auth-oauth' });

const oauthStartQuerySchema = z.object({
  intent: z.enum(['login', 'register']).catch('login'),
  from: z.string().optional(),
  lang: z.enum(['es', 'en']).catch('es'),
  plan: z.enum(['solo', 'starter', 'pro']).optional().catch(undefined),
  code: z.string().trim().max(100).optional().catch(undefined),
  ref: z.string().optional(),
});

const oauthHandoffSchema = z.object({ handle: z.string().min(1).max(200) });

function frontendUrl(path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path, env.FRONTEND_URL);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

/** Vuelve a /login o /register con un aviso, sin detalles técnicos. */
function oauthErrorRedirect(
  res: Response,
  intent: 'login' | 'register',
  code: socialAuth.OAuthErrorCode,
  lang: string,
  from?: string
): void {
  res.redirect(303, frontendUrl(intent === 'register' ? '/register' : '/login', {
    oauth_error: code,
    lang,
    from: from && from !== '/dashboard' ? from : undefined,
  }));
}

function oauthCookieOptions() {
  const isProduction = process.env['NODE_ENV'] === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/api/auth',
    ...(isProduction && { domain: '.gensmart.co' }),
  };
}

router.get('/:provider/start', oauthLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = oauthStartQuerySchema.safeParse(req.query);
  const q = parsed.success ? parsed.data : oauthStartQuerySchema.parse({});
  const provider = getOAuthProvider(String(req.params['provider']));
  if (!provider) {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    return;
  }
  const ref = signupRefSchema.safeParse(q.ref ?? '');
  try {
    const { url, state } = await socialAuth.startOAuth(provider, {
      intent: q.intent,
      from: socialAuth.safeFrom(q.from),
      lang: q.lang,
      plan: q.plan,
      code: q.code || undefined,
      ref: ref.success && ref.data ? ref.data : undefined,
    });
    // Ata el `state` a este navegador: el retorno exige la misma cookie (contra el login CSRF)
    res.cookie(OAUTH_STATE_COOKIE, state, { ...oauthCookieOptions(), maxAge: 10 * 60 * 1000 });
    res.redirect(303, url);
  } catch (err) {
    const code = err instanceof socialAuth.OAuthFlowError ? err.code : 'failed';
    if (code !== 'unavailable') console.error(`[oauth:${provider.id}] start failed:`, err instanceof Error ? err.message : 'unknown');
    oauthErrorRedirect(res, q.intent, code, q.lang);
  }
});

router.get('/:provider/callback', oauthLimiter, async (req: Request, res: Response): Promise<void> => {
  const provider = getOAuthProvider(String(req.params['provider']));
  if (!provider) {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    return;
  }
  const stateParam = typeof req.query['state'] === 'string' ? req.query['state'] : '';
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
  res.clearCookie(OAUTH_STATE_COOKIE, oauthCookieOptions());

  // El estado se consume siempre (aunque la persona haya cancelado): un `state` no sirve dos veces
  const state = await socialAuth.consumeOAuthState(stateParam, provider.id).catch(() => null);
  const lang = state?.lang ?? (req.query['lang'] === 'en' ? 'en' : 'es');
  const intent = state?.intent ?? 'login';

  if (typeof req.query['error'] === 'string') {
    oauthErrorRedirect(res, intent, req.query['error'] === 'access_denied' ? 'cancelled' : 'failed', lang, state?.from);
    return;
  }
  if (!state || !cookieState || cookieState !== stateParam) {
    oauthErrorRedirect(res, intent, 'expired', lang);
    return;
  }
  const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
  if (!code) {
    oauthErrorRedirect(res, intent, 'failed', lang, state.from);
    return;
  }

  try {
    const identity = await provider.exchangeAndVerify({ code, codeVerifier: state.codeVerifier, nonce: state.nonce });
    const outcome = await socialAuth.resolveOAuthIdentity(provider, identity, state);
    const from = outcome.kind === 'signup' ? undefined : outcome.from !== '/dashboard' ? outcome.from : undefined;
    if (outcome.kind === 'session') {
      setRefreshCookie(res, outcome.tokens.refreshToken);
      res.redirect(303, frontendUrl('/auth/google/done', { from }));
    } else if (outcome.kind === 'twoFactor') {
      res.redirect(303, frontendUrl('/login', { g2fa: outcome.handle, from, lang: outcome.lang }));
    } else {
      res.redirect(303, frontendUrl('/register/google', { t: outcome.token, nouser: outcome.noAccount ? '1' : undefined, lang: outcome.lang }));
    }
  } catch (err) {
    // Los rechazos del login de hoy (p. ej. NOT_A_MEMBER) también terminan en el aviso genérico
    const errCode: socialAuth.OAuthErrorCode = err instanceof socialAuth.OAuthFlowError ? err.code : 'failed';
    // Solo el mensaje: nunca el error completo, que podría traer la respuesta del proveedor
    if (!(err instanceof socialAuth.OAuthFlowError)) {
      const kind = err instanceof OAuthVerificationError ? 'verification' : 'flow';
      console.warn(`[oauth:${provider.id}] callback ${kind} error:`, err instanceof Error ? err.message : 'unknown');
    }
    oauthErrorRedirect(res, state.intent, errCode, lang, state.from);
  }
});

// El retorno con 2FA deja en la URL solo un identificador de un solo uso; la web lo cambia aquí por el tempToken
router.post(
  '/oauth/2fa-handoff',
  authLimiter,
  validate(oauthHandoffSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tempToken = await socialAuth.consumeTwoFactorHandoff(req.body.handle);
      res.json({ requires2FA: true, tempToken });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/oauth/signup/:token',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await socialAuth.getPendingSignup(String(req.params['token'])));
    } catch (err) {
      next(err);
    }
  }
);

// Completar el registro con un proveedor: el mismo limitador que el registro, sin Turnstile
router.post(
  '/oauth/complete',
  registerLimiter,
  validate(socialAuth.oauthCompleteSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await socialAuth.completeOAuthSignup(req.body);
      setRefreshCookie(res, result.tokens.refreshToken);
      res.status(201).json({
        accessToken: result.tokens.accessToken,
        user: result.tokens.user,
        from: result.from,
        promoApplied: result.promoApplied,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
