import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import {
  createCalendar,
  getCalendars,
  getCalendar,
  updateCalendar,
  deleteCalendar,
  getAvailableSlots,
} from '../services/calendar.service';
import {
  createAppointment,
  getAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
} from '../services/appointment.service';

// ── Zod Schemas ─────────────────────────────────────────────────────────────

const availableHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const calendarCreateSchema = z.object({
  name: z.string().min(1).max(255),
  agentId: z.string().uuid().nullable().optional(),
  timezone: z.string().optional(),
  availableDays: z.array(z.number().int().min(1).max(7)).optional(),
  availableHours: availableHoursSchema.optional(),
  slotDuration: z.number().int().min(5).max(240).optional(),
  bufferMinutes: z.number().int().min(0).max(120).optional(),
  maxAdvanceDays: z.number().int().min(1).max(365).optional(),
});

const calendarUpdateSchema = calendarCreateSchema.partial();

const appointmentCreateSchema = z.object({
  calendarId: z.string().uuid(),
  contactId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});

const appointmentUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  contactId: z.string().uuid().nullable().optional(),
});

// ── Calendar Router (mounted at /api/calendars) ───────────────────────────────

export const calendarRouter = Router();
calendarRouter.use(requireAuth, orgContext);

calendarRouter.get('/', async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const calendars = await getCalendars(orgId);
  res.json({ calendars });
});

calendarRouter.post('/', validate(calendarCreateSchema), async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const calendar = await createCalendar(orgId, req.body as z.infer<typeof calendarCreateSchema>);
  res.status(201).json({ calendar });
});

calendarRouter.get('/:id', async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const id = String(req.params['id'] ?? '');
  const calendar = await getCalendar(orgId, id);
  if (!calendar) {
    res.status(404).json({ error: 'Calendar not found' });
    return;
  }
  res.json({ calendar });
});

calendarRouter.put('/:id', validate(calendarUpdateSchema), async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const id = String(req.params['id'] ?? '');
  const calendar = await updateCalendar(orgId, id, req.body as z.infer<typeof calendarUpdateSchema>);
  if (!calendar) {
    res.status(404).json({ error: 'Calendar not found' });
    return;
  }
  res.json({ calendar });
});

calendarRouter.delete('/:id', async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const id = String(req.params['id'] ?? '');
  const deleted = await deleteCalendar(orgId, id);
  if (!deleted) {
    res.status(404).json({ error: 'Calendar not found' });
    return;
  }
  res.json({ success: true });
});

// ── Appointment Router (mounted at /api/appointments) ────────────────────────

export const appointmentRouter = Router();
appointmentRouter.use(requireAuth, orgContext);

// IMPORTANT: specific paths before param paths
appointmentRouter.get('/available-slots', async (req: Request, res: Response) => {
  const calendarId = String(req.query['calendar_id'] ?? '');
  const date = String(req.query['date'] ?? '');

  if (!calendarId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'calendar_id and date (YYYY-MM-DD) are required' });
    return;
  }

  const slots = await getAvailableSlots(calendarId, date);
  res.json({ slots, date, calendarId });
});

appointmentRouter.get('/', async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const appointments = await getAppointments(orgId, {
    calendarId: req.query['calendar_id'] ? String(req.query['calendar_id']) : undefined,
    status: req.query['status'] ? String(req.query['status']) : undefined,
    fromDate: req.query['from_date'] ? String(req.query['from_date']) : undefined,
    toDate: req.query['to_date'] ? String(req.query['to_date']) : undefined,
    agentId: req.query['agent_id'] ? String(req.query['agent_id']) : undefined,
  });
  res.json({ appointments });
});

appointmentRouter.post('/', validate(appointmentCreateSchema), async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  try {
    const appointment = await createAppointment(orgId, req.body as z.infer<typeof appointmentCreateSchema>);
    res.status(201).json({ appointment });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

appointmentRouter.get('/:id', async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const id = String(req.params['id'] ?? '');
  const appointment = await getAppointment(orgId, id);
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  res.json({ appointment });
});

appointmentRouter.put('/:id', validate(appointmentUpdateSchema), async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const id = String(req.params['id'] ?? '');
  const appointment = await updateAppointment(orgId, id, req.body as z.infer<typeof appointmentUpdateSchema>);
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  res.json({ appointment });
});

appointmentRouter.delete('/:id', async (req: Request, res: Response) => {
  const orgId = req.org!.id;
  const id = String(req.params['id'] ?? '');
  const appointment = await cancelAppointment(orgId, id);
  if (!appointment) {
    res.status(404).json({ error: 'Appointment not found' });
    return;
  }
  res.json({ appointment });
});

export default calendarRouter;
