import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { AppError } from '../middleware/errorHandler';
import { redis } from '../config/redis';
import { getOrgTimezone } from '../services/conversation-events.service';
import { getInboxSettings } from '../services/inbox-settings.service';
import { planAllowsTakeover } from '../services/conversation-actions.service';
import { buildInboxReport, parseReportPeriod, type InboxReport } from '../services/reports.service';

/**
 * Informes (web-47). Cualquier rol de la organización. La respuesta se cachea 60 s en Redis por
 * organización, plan, período y minuto; si Redis falla se calcula igual.
 */
const router = Router();
router.use(requireAuth, orgContext);

const CACHE_TTL_SECONDS = 60;

// GET /api/reports/inbox?period=today|7d|30d
router.get('/inbox', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const period = parseReportPeriod(req.query['period'] ?? 'today');
    if (!period) throw new AppError(400, 'period must be today, 7d or 30d', 'VALIDATION_ERROR');
    const org = req.org!;
    const key = `reports:inbox:${org.id}:${org.plan}:${period}:${Math.floor(Date.now() / 60000)}`;
    try {
      const hit = await redis.get(key);
      if (hit) {
        res.json(JSON.parse(hit) as InboxReport);
        return;
      }
    } catch {
      /* sin caché */
    }
    const [tz, settings] = await Promise.all([getOrgTimezone(org.id), getInboxSettings(org.id)]);
    const report = await buildInboxReport({
      organizationId: org.id,
      period,
      timeZone: tz ?? 'UTC',
      planAllowsPeople: planAllowsTakeover(org.plan),
      businessHours: settings.businessHours,
      responseGoalMinutes: settings.responseGoalMinutes,
    });
    if (report.realMinutes) console.warn(`[reports] org ${org.id}: espera calculada con minutos reales (volumen)`);
    delete report.realMinutes;
    try {
      await redis.set(key, JSON.stringify(report), 'EX', CACHE_TTL_SECONDS);
    } catch {
      /* sin caché */
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
