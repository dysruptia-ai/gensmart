import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BUSINESS_DAYS, businessHoursError, isValidHHMM, type BusinessHours } from '@gensmart/shared';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { requireRole } from '../middleware/requireRole';
import { getClient, query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { INBOX_ADMIN_ROLES, emitInbox } from '../services/inbox-annotations.service';
import { getOrgTimezone } from '../services/conversation-events.service';
import { planAllowsTakeover } from '../services/conversation-actions.service';
import { ASSIGNMENT_MODES, getInboxSettings } from '../services/inbox-settings.service';
import { assignPendingSafe, getTeam } from '../services/inbox-assignment.service';
import { onlineUsers } from '../services/presence.service';

/**
 * Ajustes de la Bandeja (web-45): Asignación y Horarios y meta. Todo el equipo los lee; solo owner y
 * admin los cambian.
 */
const router = Router();
router.use(requireAuth, orgContext);

async function buildResponse(orgId: string, plan: string) {
  const [settings, timezone, team, online, assignees] = await Promise.all([
    getInboxSettings(orgId),
    getOrgTimezone(orgId),
    getTeam(orgId),
    onlineUsers(orgId),
    query<{ agent_id: string; agent_name: string; user_id: string | null }>(
      `SELECT a.id AS agent_id, a.name AS agent_name, ia.user_id
       FROM agents a LEFT JOIN inbox_agent_assignees ia ON ia.agent_id = a.id
       WHERE a.organization_id = $1 ORDER BY a.name, a.id`,
      [orgId]
    ),
  ]);
  const onlineSet = new Set(online);
  return {
    settings,
    timezone,
    plan,
    canTakeOver: planAllowsTakeover(plan),
    team: team.map((m) => ({ ...m, online: onlineSet.has(m.userId) })),
    agentAssignees: assignees.rows.map((r) => ({ agentId: r.agent_id, agentName: r.agent_name, userId: r.user_id })),
  };
}

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await buildResponse(req.org!.id, req.org!.plan));
  } catch (err) {
    next(err);
  }
});

const dayHoursSchema = z
  .object({ open: z.string().refine(isValidHHMM), close: z.string().refine(isValidHHMM) })
  .nullable();

const businessHoursSchema = z
  .object(Object.fromEntries(BUSINESS_DAYS.map((d) => [d, dayHoursSchema.optional()])) as Record<string, z.ZodOptional<typeof dayHoursSchema>>)
  .strict()
  .nullable();

export const inboxSettingsUpdateSchema = z
  .object({
    assignmentMode: z.enum(ASSIGNMENT_MODES as unknown as ['rotating', 'agent', 'none']).optional(),
    keepLastPerson: z.boolean().optional(),
    businessHours: businessHoursSchema.optional(),
    outOfHoursNotice: z.boolean().optional(),
    responseGoalMinutes: z.number().int().min(1).max(240).optional(),
    alertEmailMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    members: z
      .array(
        z.object({
          userId: z.string().uuid(),
          capacity: z.number().int().min(1).max(100),
          receives: z.boolean(),
        })
      )
      .max(500)
      .optional(),
    agentAssignees: z
      .array(z.object({ agentId: z.string().uuid(), userId: z.string().uuid().nullable() }))
      .max(500)
      .optional(),
  })
  .strict();

router.put(
  '/',
  requireRole(...INBOX_ADMIN_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.org!.id;
    try {
      const body = inboxSettingsUpdateSchema.parse(req.body);
      const current = await getInboxSettings(orgId);
      const next_ = { ...current, ...body } as typeof current;
      if (body.businessHours !== undefined) next_.businessHours = (body.businessHours ?? null) as BusinessHours;

      const hoursErr = businessHoursError(next_.businessHours);
      if (hoursErr) {
        throw new AppError(422, 'Opening time must be before closing time, in HH:MM', 'invalid_business_hours');
      }
      if (next_.alertEmailMinutes !== null && next_.alertEmailMinutes <= next_.responseGoalMinutes) {
        throw new AppError(422, 'The alert must be later than the response goal', 'alert_not_above_goal');
      }
      if (next_.assignmentMode !== 'none' && !planAllowsTakeover(req.org!.plan)) {
        throw new AppError(403, 'Automatic assignment requires the Starter plan or higher', 'PLAN_LIMIT');
      }

      // Equipo y responsables: solo de la organización
      if (body.members?.length) {
        const ids = [...new Set(body.members.map((m) => m.userId))];
        const own = await query<{ count: string }>(
          'SELECT COUNT(*) AS count FROM user_organizations WHERE organization_id = $1 AND user_id = ANY($2::uuid[])',
          [orgId, ids]
        );
        if (parseInt(own.rows[0]?.count ?? '0', 10) !== ids.length) {
          throw new AppError(400, 'That person is not on this team', 'NOT_A_MEMBER');
        }
      }
      if (body.agentAssignees?.length) {
        const agentIds = [...new Set(body.agentAssignees.map((a) => a.agentId))];
        const userIds = [...new Set(body.agentAssignees.map((a) => a.userId).filter((u): u is string => !!u))];
        const r = await query<{ agents: string; users: string }>(
          `SELECT (SELECT COUNT(*) FROM agents WHERE organization_id = $1 AND id = ANY($2::uuid[])) AS agents,
                  (SELECT COUNT(*) FROM user_organizations WHERE organization_id = $1 AND user_id = ANY($3::uuid[])) AS users`,
          [orgId, agentIds, userIds]
        );
        if (parseInt(r.rows[0]?.agents ?? '0', 10) !== agentIds.length) throw new AppError(400, 'Unknown agent', 'UNKNOWN_AGENT');
        if (parseInt(r.rows[0]?.users ?? '0', 10) !== userIds.length) {
          throw new AppError(400, 'That person is not on this team', 'NOT_A_MEMBER');
        }
      }

      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO inbox_settings (organization_id, assignment_mode, keep_last_person, business_hours, out_of_hours_notice,
                                       response_goal_minutes, alert_email_minutes, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (organization_id) DO UPDATE SET
             assignment_mode = EXCLUDED.assignment_mode, keep_last_person = EXCLUDED.keep_last_person,
             business_hours = EXCLUDED.business_hours, out_of_hours_notice = EXCLUDED.out_of_hours_notice,
             response_goal_minutes = EXCLUDED.response_goal_minutes, alert_email_minutes = EXCLUDED.alert_email_minutes,
             updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
          [
            orgId,
            next_.assignmentMode,
            next_.keepLastPerson,
            next_.businessHours === null ? null : JSON.stringify(next_.businessHours),
            next_.outOfHoursNotice,
            next_.responseGoalMinutes,
            next_.alertEmailMinutes,
            req.user!.userId,
          ]
        );
        for (const m of body.members ?? []) {
          await client.query(
            `INSERT INTO inbox_member_settings (organization_id, user_id, capacity, receives)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (organization_id, user_id) DO UPDATE SET capacity = EXCLUDED.capacity, receives = EXCLUDED.receives`,
            [orgId, m.userId, m.capacity, m.receives]
          );
        }
        for (const a of body.agentAssignees ?? []) {
          if (a.userId) {
            await client.query(
              `INSERT INTO inbox_agent_assignees (agent_id, organization_id, user_id) VALUES ($1, $2, $3)
               ON CONFLICT (agent_id) DO UPDATE SET user_id = EXCLUDED.user_id`,
              [a.agentId, orgId, a.userId]
            );
          } else {
            await client.query('DELETE FROM inbox_agent_assignees WHERE agent_id = $1 AND organization_id = $2', [a.agentId, orgId]);
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }

      emitInbox(orgId, 'inbox-settings:changed', { updatedBy: req.user!.userId });
      // Con un modo nuevo o más cupo, lo que esperaba puede repartirse ya
      assignPendingSafe(orgId);
      res.json(await buildResponse(orgId, req.org!.plan));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
