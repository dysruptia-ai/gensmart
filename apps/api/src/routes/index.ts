import { Router } from 'express';
import authRouter from './auth';
import agentsRouter from './agents';
import conversationsRouter from './conversations';
import contactsRouter from './contacts';
import funnelRouter from './funnel';
import { calendarRouter, appointmentRouter } from './calendar';
import billingRouter from './billing';
import whatsappRouter from './whatsapp';
import widgetRouter from './widget';
import mobileRouter from './mobile';
import knowledgeRouter from './knowledge';
import organizationRouter from './organization';
import notificationsRouter from './notifications';
import dashboardRouter from './dashboard';
import accountRouter from './account';
import lookupRouter from './lookup';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.use('/auth', authRouter);
router.use('/agents', agentsRouter);
router.use('/conversations', conversationsRouter);
router.use('/contacts', contactsRouter);
router.use('/funnel', funnelRouter);
router.use('/calendars', calendarRouter);
router.use('/appointments', appointmentRouter);
router.use('/billing', billingRouter);
router.use('/whatsapp', whatsappRouter);
router.use('/widget', widgetRouter);
router.use('/mobile', mobileRouter);
router.use('/knowledge', knowledgeRouter);
router.use('/organization', organizationRouter);
router.use('/notifications', notificationsRouter);
router.use('/dashboard', dashboardRouter);
router.use('/account', accountRouter);
router.use('/lookup', lookupRouter);

export default router;
