"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const orgContext_1 = require("../middleware/orgContext");
const notification_service_1 = require("../services/notification.service");
const router = (0, express_1.Router)();
const listQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: zod_1.z.coerce.number().int().min(0).optional().default(0),
});
const uuidSchema = zod_1.z.string().uuid();
// GET /api/notifications
router.get('/', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const parsed = listQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({ error: { message: 'Invalid query params', details: parsed.error.flatten() } });
            return;
        }
        const { limit, offset } = parsed.data;
        const userId = req.user.userId;
        const orgId = req.user.orgId;
        const result = await (0, notification_service_1.listNotifications)(userId, orgId, { limit, offset });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/notifications/unread-count
router.get('/unread-count', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const count = await (0, notification_service_1.getUnreadCount)(req.user.userId, req.user.orgId);
        res.json({ count });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/notifications/read-all
router.put('/read-all', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const updated = await (0, notification_service_1.markAllAsRead)(req.user.userId, req.user.orgId);
        res.json({ updated });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/notifications/:id/read
router.put('/:id/read', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const idParse = uuidSchema.safeParse(String(req.params['id']));
        if (!idParse.success) {
            res.status(400).json({ error: { message: 'Invalid notification ID' } });
            return;
        }
        await (0, notification_service_1.markAsRead)(idParse.data, req.user.userId);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map