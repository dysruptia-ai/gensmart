"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentRouter = exports.calendarRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const orgContext_1 = require("../middleware/orgContext");
const validate_1 = require("../middleware/validate");
const calendar_service_1 = require("../services/calendar.service");
const appointment_service_1 = require("../services/appointment.service");
// ── Zod Schemas ─────────────────────────────────────────────────────────────
const availableHoursSchema = zod_1.z.object({
    start: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    end: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
});
const calendarCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    agentId: zod_1.z.string().uuid().nullable().optional(),
    timezone: zod_1.z.string().optional(),
    availableDays: zod_1.z.array(zod_1.z.number().int().min(1).max(7)).optional(),
    availableHours: availableHoursSchema.optional(),
    slotDuration: zod_1.z.number().int().min(5).max(240).optional(),
    bufferMinutes: zod_1.z.number().int().min(0).max(120).optional(),
    maxAdvanceDays: zod_1.z.number().int().min(1).max(365).optional(),
    notificationEmail: zod_1.z.string().email().max(255).nullable().optional(),
});
const calendarUpdateSchema = calendarCreateSchema.partial();
const appointmentCreateSchema = zod_1.z.object({
    calendarId: zod_1.z.string().uuid(),
    contactId: zod_1.z.string().uuid().nullable().optional(),
    conversationId: zod_1.z.string().uuid().nullable().optional(),
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().nullable().optional(),
    startTime: zod_1.z.string().datetime({ offset: true }),
    endTime: zod_1.z.string().datetime({ offset: true }),
    status: zod_1.z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});
const appointmentUpdateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().nullable().optional(),
    startTime: zod_1.z.string().datetime({ offset: true }).optional(),
    endTime: zod_1.z.string().datetime({ offset: true }).optional(),
    status: zod_1.z.enum(['scheduled', 'completed', 'cancelled']).optional(),
    contactId: zod_1.z.string().uuid().nullable().optional(),
});
// ── Calendar Router (mounted at /api/calendars) ───────────────────────────────
exports.calendarRouter = (0, express_1.Router)();
exports.calendarRouter.use(auth_1.requireAuth, orgContext_1.orgContext);
exports.calendarRouter.get('/', async (req, res) => {
    const orgId = req.org.id;
    const calendars = await (0, calendar_service_1.getCalendars)(orgId);
    res.json({ calendars });
});
exports.calendarRouter.post('/', (0, validate_1.validate)(calendarCreateSchema), async (req, res) => {
    const orgId = req.org.id;
    const calendar = await (0, calendar_service_1.createCalendar)(orgId, req.body);
    res.status(201).json({ calendar });
});
exports.calendarRouter.get('/:id', async (req, res) => {
    const orgId = req.org.id;
    const id = String(req.params['id'] ?? '');
    const calendar = await (0, calendar_service_1.getCalendar)(orgId, id);
    if (!calendar) {
        res.status(404).json({ error: 'Calendar not found' });
        return;
    }
    res.json({ calendar });
});
exports.calendarRouter.put('/:id', (0, validate_1.validate)(calendarUpdateSchema), async (req, res) => {
    const orgId = req.org.id;
    const id = String(req.params['id'] ?? '');
    const calendar = await (0, calendar_service_1.updateCalendar)(orgId, id, req.body);
    if (!calendar) {
        res.status(404).json({ error: 'Calendar not found' });
        return;
    }
    res.json({ calendar });
});
exports.calendarRouter.delete('/:id', async (req, res) => {
    const orgId = req.org.id;
    const id = String(req.params['id'] ?? '');
    const deleted = await (0, calendar_service_1.deleteCalendar)(orgId, id);
    if (!deleted) {
        res.status(404).json({ error: 'Calendar not found' });
        return;
    }
    res.json({ success: true });
});
// ── Appointment Router (mounted at /api/appointments) ────────────────────────
exports.appointmentRouter = (0, express_1.Router)();
exports.appointmentRouter.use(auth_1.requireAuth, orgContext_1.orgContext);
// IMPORTANT: specific paths before param paths
exports.appointmentRouter.get('/available-slots', async (req, res) => {
    const calendarId = String(req.query['calendar_id'] ?? '');
    const date = String(req.query['date'] ?? '');
    if (!calendarId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'calendar_id and date (YYYY-MM-DD) are required' });
        return;
    }
    const slots = await (0, calendar_service_1.getAvailableSlots)(calendarId, date);
    res.json({ slots, date, calendarId });
});
exports.appointmentRouter.get('/', async (req, res) => {
    const orgId = req.org.id;
    const appointments = await (0, appointment_service_1.getAppointments)(orgId, {
        calendarId: req.query['calendar_id'] ? String(req.query['calendar_id']) : undefined,
        status: req.query['status'] ? String(req.query['status']) : undefined,
        fromDate: req.query['from_date'] ? String(req.query['from_date']) : undefined,
        toDate: req.query['to_date'] ? String(req.query['to_date']) : undefined,
        agentId: req.query['agent_id'] ? String(req.query['agent_id']) : undefined,
    });
    res.json({ appointments });
});
exports.appointmentRouter.post('/', (0, validate_1.validate)(appointmentCreateSchema), async (req, res) => {
    const orgId = req.org.id;
    try {
        const appointment = await (0, appointment_service_1.createAppointment)(orgId, req.body);
        res.status(201).json({ appointment });
    }
    catch (err) {
        res.status(409).json({ error: err.message });
    }
});
exports.appointmentRouter.get('/:id', async (req, res) => {
    const orgId = req.org.id;
    const id = String(req.params['id'] ?? '');
    const appointment = await (0, appointment_service_1.getAppointment)(orgId, id);
    if (!appointment) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
    }
    res.json({ appointment });
});
exports.appointmentRouter.put('/:id', (0, validate_1.validate)(appointmentUpdateSchema), async (req, res) => {
    const orgId = req.org.id;
    const id = String(req.params['id'] ?? '');
    const appointment = await (0, appointment_service_1.updateAppointment)(orgId, id, req.body);
    if (!appointment) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
    }
    res.json({ appointment });
});
exports.appointmentRouter.delete('/:id', async (req, res) => {
    const orgId = req.org.id;
    const id = String(req.params['id'] ?? '');
    const appointment = await (0, appointment_service_1.cancelAppointment)(orgId, id);
    if (!appointment) {
        res.status(404).json({ error: 'Appointment not found' });
        return;
    }
    res.json({ appointment });
});
exports.default = exports.calendarRouter;
//# sourceMappingURL=calendar.js.map