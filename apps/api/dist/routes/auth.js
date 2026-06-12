"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const rateLimiter_1 = require("../middleware/rateLimiter");
const validate_1 = require("../middleware/validate");
const auth_1 = require("../middleware/auth");
const authService = __importStar(require("../services/auth.service"));
const shared_1 = require("@gensmart/shared");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
const authLimiter = (0, rateLimiter_1.rateLimiter)({ windowSeconds: 60, maxRequests: 10, keyPrefix: 'auth' });
const verify2FASchema = zod_1.z.object({
    tempToken: zod_1.z.string().min(1),
    code: zod_1.z.string().min(6).max(8),
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z.string().min(8),
});
const enable2FASchema = zod_1.z.object({
    secret: zod_1.z.string().min(1),
    code: zod_1.z.string().length(6),
});
const disable2FASchema = zod_1.z.object({
    password: zod_1.z.string().min(1),
});
const updateMeSchema = zod_1.z.object({
    language: zod_1.z.enum(['en', 'es']).optional(),
    name: zod_1.z.string().min(1).max(255).optional(),
});
function setRefreshCookie(res, token) {
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
router.post('/register', authLimiter, (0, validate_1.validate)(shared_1.registerSchema), async (req, res, next) => {
    try {
        const tokens = await authService.register(req.body);
        setRefreshCookie(res, tokens.refreshToken);
        res.status(201).json({
            accessToken: tokens.accessToken,
            user: tokens.user,
        });
    }
    catch (err) {
        next(err);
    }
});
router.post('/login', authLimiter, (0, validate_1.validate)(shared_1.loginSchema), async (req, res, next) => {
    try {
        const result = await authService.login(req.body);
        if ('requires2FA' in result) {
            res.json({ requires2FA: true, tempToken: result.tempToken });
            return;
        }
        setRefreshCookie(res, result.refreshToken);
        res.json({ accessToken: result.accessToken, user: result.user });
    }
    catch (err) {
        next(err);
    }
});
router.post('/refresh', async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.['refresh_token'];
        if (!refreshToken) {
            res.status(401).json({ error: { message: 'No refresh token', code: 'NO_REFRESH_TOKEN' } });
            return;
        }
        const tokens = await authService.refreshToken(refreshToken);
        setRefreshCookie(res, tokens.refreshToken);
        res.json({ accessToken: tokens.accessToken, user: tokens.user });
    }
    catch (err) {
        next(err);
    }
});
router.post('/logout', async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.['refresh_token'];
        if (refreshToken) {
            await authService.logout(refreshToken);
        }
        const isProduction = process.env['NODE_ENV'] === 'production';
        res.clearCookie('refresh_token', {
            path: '/',
            ...(isProduction && { domain: '.gensmart.co' }),
        });
        res.json({ message: 'Logged out successfully' });
    }
    catch (err) {
        next(err);
    }
});
router.post('/forgot-password', authLimiter, (0, validate_1.validate)(forgotPasswordSchema), async (req, res, next) => {
    try {
        await authService.forgotPassword(req.body.email);
        res.json({ message: 'If an account exists with that email, we sent a reset link.' });
    }
    catch (err) {
        next(err);
    }
});
router.post('/reset-password', authLimiter, (0, validate_1.validate)(resetPasswordSchema), async (req, res, next) => {
    try {
        await authService.resetPassword(req.body);
        res.json({ message: 'Password reset successfully' });
    }
    catch (err) {
        next(err);
    }
});
router.post('/2fa/setup', auth_1.requireAuth, async (req, res, next) => {
    try {
        const result = await authService.setup2FA(req.user.userId);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post('/2fa/enable', auth_1.requireAuth, (0, validate_1.validate)(enable2FASchema), async (req, res, next) => {
    try {
        const result = await authService.enable2FA(req.user.userId, req.body.secret, req.body.code);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post('/2fa/disable', auth_1.requireAuth, (0, validate_1.validate)(disable2FASchema), async (req, res, next) => {
    try {
        await authService.disable2FA(req.user.userId, req.body.password);
        res.json({ message: '2FA disabled successfully' });
    }
    catch (err) {
        next(err);
    }
});
router.post('/2fa/verify', authLimiter, (0, validate_1.validate)(verify2FASchema), async (req, res, next) => {
    try {
        const tokens = await authService.verify2FA(req.body);
        setRefreshCookie(res, tokens.refreshToken);
        res.json({ accessToken: tokens.accessToken, user: tokens.user });
    }
    catch (err) {
        next(err);
    }
});
// Update current user preferences (language, name)
router.put('/me', auth_1.requireAuth, (0, validate_1.validate)(updateMeSchema), async (req, res, next) => {
    try {
        const { language, name } = req.body;
        const sets = [];
        const params = [];
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
        params.push(req.user.userId);
        await (0, database_1.query)(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, params);
        res.json({ message: 'Profile updated' });
    }
    catch (err) {
        next(err);
    }
});
// Update onboarding progress
const onboardingSchema = zod_1.z.object({
    step: zod_1.z.number().int().min(0).max(10).optional(),
    completed: zod_1.z.boolean().optional(),
    editorTourCompleted: zod_1.z.boolean().optional(),
});
router.put('/onboarding', auth_1.requireAuth, (0, validate_1.validate)(onboardingSchema), async (req, res, next) => {
    try {
        const { step, completed, editorTourCompleted } = req.body;
        const sets = [];
        const params = [];
        let idx = 1;
        if (completed === true) {
            sets.push(`onboarding_completed = TRUE`);
            sets.push(`onboarding_step = 0`);
        }
        else {
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
        }
        else if (editorTourCompleted === false) {
            sets.push(`editor_tour_completed = FALSE`);
        }
        if (sets.length === 0) {
            res.json({ success: true });
            return;
        }
        sets.push(`updated_at = NOW()`);
        params.push(req.user.userId);
        await (0, database_1.query)(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, params);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map