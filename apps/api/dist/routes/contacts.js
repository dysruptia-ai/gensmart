"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const orgContext_1 = require("../middleware/orgContext");
const validateUUID_1 = require("../middleware/validateUUID");
const validate_1 = require("../middleware/validate");
const errorHandler_1 = require("../middleware/errorHandler");
const database_1 = require("../config/database");
const queues_1 = require("../config/queues");
const contact_service_1 = require("../services/contact.service");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, orgContext_1.orgContext);
const updateContactSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    phone: zod_1.z.string().max(50).optional(),
    email: zod_1.z.string().email().max(255).optional(),
    funnel_stage: zod_1.z.enum(['lead', 'opportunity', 'customer']).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    notes: zod_1.z.string().optional(),
});
const updateStageSchema = zod_1.z.object({
    stage: zod_1.z.enum(['lead', 'opportunity', 'customer']),
});
// POST /contacts/export — must be before /:id routes
router.post('/export', async (req, res, next) => {
    try {
        const b = req.body;
        const csv = await (0, contact_service_1.exportContactsCSV)(req.org.id, {
            search: typeof b['search'] === 'string' ? b['search'] : undefined,
            agentId: typeof b['agentId'] === 'string' ? b['agentId'] : undefined,
            funnelStage: typeof b['funnelStage'] === 'string' ? b['funnelStage'] : undefined,
            scoreMin: typeof b['scoreMin'] === 'number' ? b['scoreMin'] : undefined,
            scoreMax: typeof b['scoreMax'] === 'number' ? b['scoreMax'] : undefined,
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
        res.send(csv);
    }
    catch (err) {
        next(err);
    }
});
// GET /contacts
router.get('/', async (req, res, next) => {
    try {
        const q = req.query;
        const result = await (0, contact_service_1.getContacts)(req.org.id, {
            search: q['search'],
            agentId: q['agentId'],
            funnelStage: q['stage'],
            scoreMin: q['scoreMin'] ? parseInt(q['scoreMin'], 10) : undefined,
            scoreMax: q['scoreMax'] ? parseInt(q['scoreMax'], 10) : undefined,
            sortBy: q['sort'],
            sortOrder: q['order'] || 'desc',
            page: q['page'] ? parseInt(q['page'], 10) : 1,
            limit: q['limit'] ? parseInt(q['limit'], 10) : 20,
        });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// GET /contacts/:id
router.get('/:id', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const contact = await (0, contact_service_1.getContactById)(req.org.id, String(req.params['id']));
        if (!contact)
            throw new errorHandler_1.AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
        res.json({ contact });
    }
    catch (err) {
        next(err);
    }
});
// PUT /contacts/:id
router.put('/:id', (0, validateUUID_1.validateUUID)('id'), (0, validate_1.validate)(updateContactSchema), async (req, res, next) => {
    try {
        const contact = await (0, contact_service_1.updateContact)(req.org.id, String(req.params['id']), req.body);
        if (!contact)
            throw new errorHandler_1.AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
        res.json({ contact });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /contacts/:id
router.delete('/:id', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const deleted = await (0, contact_service_1.deleteContact)(req.org.id, String(req.params['id']));
        if (!deleted)
            throw new errorHandler_1.AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// GET /contacts/:id/conversations
router.get('/:id/conversations', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const conversations = await (0, contact_service_1.getContactConversations)(req.org.id, String(req.params['id']));
        res.json({ conversations });
    }
    catch (err) {
        next(err);
    }
});
// GET /contacts/:id/timeline
router.get('/:id/timeline', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const events = await (0, contact_service_1.getContactTimeline)(req.org.id, String(req.params['id']));
        res.json({ events });
    }
    catch (err) {
        next(err);
    }
});
// PUT /contacts/:id/stage
router.put('/:id/stage', (0, validateUUID_1.validateUUID)('id'), (0, validate_1.validate)(updateStageSchema), async (req, res, next) => {
    try {
        const { stage } = req.body;
        const contact = await (0, contact_service_1.updateContactStage)(req.org.id, String(req.params['id']), stage);
        if (!contact)
            throw new errorHandler_1.AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
        res.json({ contact });
    }
    catch (err) {
        next(err);
    }
});
// POST /contacts/:id/analyze — trigger AI scoring for the contact's last conversation
router.post('/:id/analyze', (0, validateUUID_1.validateUUID)('id'), async (req, res, next) => {
    try {
        const contactId = String(req.params['id']);
        const orgId = req.org.id;
        const convResult = await (0, database_1.query)(`SELECT id FROM conversations
         WHERE contact_id = $1 AND organization_id = $2
         ORDER BY created_at DESC LIMIT 1`, [contactId, orgId]);
        const conversationId = convResult.rows[0]?.id;
        if (!conversationId) {
            throw new errorHandler_1.AppError(404, 'No conversation found for this contact', 'NO_CONVERSATION');
        }
        await queues_1.scoringQueue.add('score-conversation', { conversationId, organizationId: orgId, trigger: 'manual' }, { priority: 1 });
        res.json({ message: 'Analysis started', conversationId });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=contacts.js.map