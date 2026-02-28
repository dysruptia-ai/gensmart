import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import { query } from '../config/database';
import { updateContactStage } from '../services/contact.service';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(requireAuth, orgContext);

const moveSchema = z.object({
  contactId: z.string().uuid(),
  fromStage: z.enum(['lead', 'opportunity', 'customer']),
  toStage: z.enum(['lead', 'opportunity', 'customer']),
});

// GET /funnel — contacts grouped by stage
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.org!.id;
      const { agentId } = req.query as Record<string, string>;

      const conditions: string[] = ['organization_id = $1'];
      const params: unknown[] = [orgId];

      if (agentId) {
        conditions.push('agent_id = $2');
        params.push(agentId);
      }

      const where = conditions.join(' AND ');

      const result = await query<{
        id: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        avatar_url: string | null;
        ai_score: number | null;
        ai_service: string | null;
        funnel_stage: string;
        source_channel: string | null;
        created_at: string;
      }>(
        `SELECT id, name, phone, email, avatar_url, ai_score, ai_service,
                funnel_stage, source_channel, created_at
         FROM contacts
         WHERE ${where}
         ORDER BY created_at DESC`,
        params
      );

      const lead = result.rows.filter((c) => c.funnel_stage === 'lead');
      const opportunity = result.rows.filter((c) => c.funnel_stage === 'opportunity');
      const customer = result.rows.filter((c) => c.funnel_stage === 'customer');

      res.json({
        stages: [
          { id: 'lead', name: 'Lead', contacts: lead, count: lead.length },
          { id: 'opportunity', name: 'Opportunity', contacts: opportunity, count: opportunity.length },
          { id: 'customer', name: 'Customer', contacts: customer, count: customer.length },
        ],
        total: result.rows.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /funnel/stats
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.org!.id;

      const result = await query<{
        funnel_stage: string;
        count: string;
        avg_score: string | null;
      }>(
        `SELECT funnel_stage, COUNT(*) as count, AVG(ai_score) as avg_score
         FROM contacts
         WHERE organization_id = $1
         GROUP BY funnel_stage`,
        [orgId]
      );

      const byStage: Record<string, number> = { lead: 0, opportunity: 0, customer: 0 };
      let totalWeightedScore = 0;
      let scoredCount = 0;

      for (const row of result.rows) {
        const count = parseInt(row.count, 10);
        byStage[row.funnel_stage] = count;
        if (row.avg_score !== null) {
          totalWeightedScore += parseFloat(row.avg_score) * count;
          scoredCount += count;
        }
      }

      const totalLeads = byStage['lead'] ?? 0;
      const totalOpportunities = byStage['opportunity'] ?? 0;
      const totalCustomers = byStage['customer'] ?? 0;

      const conversionLeadToOpp =
        totalLeads + totalOpportunities > 0
          ? Math.round((totalOpportunities / (totalLeads + totalOpportunities)) * 100)
          : 0;

      const conversionOppToCustomer =
        totalOpportunities + totalCustomers > 0
          ? Math.round((totalCustomers / (totalOpportunities + totalCustomers)) * 100)
          : 0;

      const avgScore = scoredCount > 0 ? Math.round((totalWeightedScore / scoredCount) * 10) / 10 : 0;

      res.json({
        totalLeads,
        totalOpportunities,
        totalCustomers,
        conversionLeadToOpp,
        conversionOppToCustomer,
        avgScore,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /funnel/move
router.put(
  '/move',
  validate(moveSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { contactId, fromStage, toStage } = req.body as z.infer<typeof moveSchema>;

      if (fromStage === toStage) {
        res.json({ message: 'No change needed' });
        return;
      }

      const contact = await updateContactStage(req.org!.id, contactId, toStage);
      if (!contact) {
        throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
      }

      res.json({ contact, message: `Moved from ${fromStage} to ${toStage}` });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
