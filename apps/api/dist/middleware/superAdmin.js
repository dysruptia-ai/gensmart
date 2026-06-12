"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = requireSuperAdmin;
/**
 * Middleware that checks if the authenticated user is a super admin.
 * MUST be used AFTER requireAuth middleware.
 */
function requireSuperAdmin(req, res, next) {
    if (!req.user?.isSuperAdmin) {
        res.status(403).json({ error: { message: 'Forbidden: Super admin access required', code: 'FORBIDDEN' } });
        return;
    }
    next();
}
//# sourceMappingURL=superAdmin.js.map