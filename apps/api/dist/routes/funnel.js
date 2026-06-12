"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const orgContext_1 = require("../middleware/orgContext");
const validate_1 = require("../middleware/validate");
const database_1 = require("../config/database");
const contact_service_1 = require("../services/contact.service");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, orgContext_1.orgContext);
const moveSchema = zod_1.z.object({
    contactId: zod_1.z.string().uuid(),
    fromStage: zod_1.z.enum(['lead', 'opportunity', 'customer']),
    toStage: zod_1.z.enum(['lead', 'opportunity', 'customer']),
});
// GET /funnel — contacts grouped by stage
router.get('/', async (req, res, next) => {
    try {
        const orgId = req.org.id;
        const { agentId } = req.query;
        const aliasedConditions = ['c.organization_id = $1'];
        const params = [orgId];
        if (agentId) {
            aliasedConditions.push('c.agent_id = $2');
            params.push(agentId);
        }
        const aliasedWhere = aliasedConditions.join(' AND ');
        const result = await (0, database_1.query)(`SELECT c.id, c.name, c.phone, c.email, c.avatar_url, c.ai_score, c.ai_service,
                c.funnel_stage, c.source_channel, c.created_at,
                a.name AS agent_name
         FROM contacts c
         LEFT JOIN agents a ON a.id = c.agent_id
         WHERE ${aliasedWhere}
         ORDER BY c.created_at DESC`, params);
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
    }
    catch (err) {
        next(err);
    }
});
// GET /funnel/stats
router.get('/stats', async (req, res, next) => {
    try {
        const orgId = req.org.id;
        const result = await (0, database_1.query)(`SELECT funnel_stage, COUNT(*) as count, AVG(ai_score) as avg_score
         FROM contacts
         WHERE organization_id = $1
         GROUP BY funnel_stage`, [orgId]);
        const byStage = { lead: 0, opportunity: 0, customer: 0 };
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
        const conversionLeadToOpp = totalLeads + totalOpportunities > 0
            ? Math.round((totalOpportunities / (totalLeads + totalOpportunities)) * 100)
            : 0;
        const conversionOppToCustomer = totalOpportunities + totalCustomers > 0
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
    }
    catch (err) {
        next(err);
    }
});
// PUT /funnel/move
router.put('/move', (0, validate_1.validate)(moveSchema), async (req, res, next) => {
    try {
        const { contactId, fromStage, toStage } = req.body;
        if (fromStage === toStage) {
            res.json({ message: 'No change needed' });
            return;
        }
        const contact = await (0, contact_service_1.updateContactStage)(req.org.id, contactId, toStage);
        if (!contact) {
            throw new errorHandler_1.AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND');
        }
        res.json({ contact, message: `Moved from ${fromStage} to ${toStage}` });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=funnel.js.map