"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const orgContext_1 = require("../middleware/orgContext");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const shared_1 = require("@gensmart/shared");
const router = (0, express_1.Router)();
function pctChange(current, previous) {
    if (previous === 0)
        return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}
function getMonthKey(orgId) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `usage:${orgId}:${ym}:messages`;
}
// GET /api/dashboard/stats
router.get('/stats', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const plan = req.org.plan;
        const [todayRes, yesterdayRes, thisWeekRes, prevWeekRes, thisMonthRes, prevMonthRes, activeConvRes, avgScoreRes,] = await Promise.all([
            (0, database_1.query)(`SELECT COUNT(*) as count FROM contacts
           WHERE organization_id = $1 AND created_at >= CURRENT_DATE`, [orgId]),
            (0, database_1.query)(`SELECT COUNT(*) as count FROM contacts
           WHERE organization_id = $1
             AND created_at >= CURRENT_DATE - INTERVAL '1 day'
             AND created_at < CURRENT_DATE`, [orgId]),
            (0, database_1.query)(`SELECT COUNT(*) as count FROM contacts
           WHERE organization_id = $1 AND created_at >= date_trunc('week', CURRENT_DATE)`, [orgId]),
            (0, database_1.query)(`SELECT COUNT(*) as count FROM contacts
           WHERE organization_id = $1
             AND created_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
             AND created_at < date_trunc('week', CURRENT_DATE)`, [orgId]),
            (0, database_1.query)(`SELECT COUNT(*) as count FROM contacts
           WHERE organization_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)`, [orgId]),
            (0, database_1.query)(`SELECT COUNT(*) as count FROM contacts
           WHERE organization_id = $1
             AND created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
             AND created_at < date_trunc('month', CURRENT_DATE)`, [orgId]),
            (0, database_1.query)(`SELECT COUNT(*) as count FROM conversations
           WHERE organization_id = $1 AND status = 'active'`, [orgId]),
            (0, database_1.query)(`SELECT COALESCE(ROUND(AVG(ai_score)::numeric, 1), 0) as avg
           FROM contacts WHERE organization_id = $1 AND ai_score IS NOT NULL`, [orgId]),
        ]);
        const today = parseInt(todayRes.rows[0]?.count ?? '0', 10);
        const yesterday = parseInt(yesterdayRes.rows[0]?.count ?? '0', 10);
        const thisWeek = parseInt(thisWeekRes.rows[0]?.count ?? '0', 10);
        const prevWeek = parseInt(prevWeekRes.rows[0]?.count ?? '0', 10);
        const thisMonth = parseInt(thisMonthRes.rows[0]?.count ?? '0', 10);
        const prevMonth = parseInt(prevMonthRes.rows[0]?.count ?? '0', 10);
        const activeConversations = parseInt(activeConvRes.rows[0]?.count ?? '0', 10);
        const avgLeadScore = parseFloat(avgScoreRes.rows[0]?.avg ?? '0');
        // Messages usage
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const addonKey = `usage:${orgId}:${ym}:addon_messages`;
        const [usedStr, addonStr] = await Promise.all([
            redis_1.redis.get(getMonthKey(orgId)),
            redis_1.redis.get(addonKey),
        ]);
        const messagesUsed = parseInt(usedStr ?? '0', 10);
        const addonMessages = parseInt(addonStr ?? '0', 10);
        const planLimit = shared_1.PLAN_LIMITS[plan]?.messagesPerMonth ?? 50;
        const effectiveLimit = planLimit + addonMessages;
        const messagesPercent = effectiveLimit > 0
            ? Math.min(100, Math.round((messagesUsed / effectiveLimit) * 100))
            : 0;
        res.json({
            leads: {
                today,
                todayChange: pctChange(today, yesterday),
                week: thisWeek,
                weekChange: pctChange(thisWeek, prevWeek),
                month: thisMonth,
                monthChange: pctChange(thisMonth, prevMonth),
            },
            activeConversations,
            avgLeadScore,
            messages: {
                used: messagesUsed,
                limit: effectiveLimit,
                percent: messagesPercent,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/dashboard/leads-chart?period=7d|30d|90d
router.get('/leads-chart', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const periodSchema = zod_1.z.enum(['7d', '30d', '90d']).default('7d');
        const parsed = periodSchema.safeParse(req.query['period']);
        const period = parsed.success ? parsed.data : '7d';
        let rows;
        if (period === '90d') {
            const result = await (0, database_1.query)(`SELECT date_trunc('week', created_at)::date as date, COUNT(*) as count
           FROM contacts
           WHERE organization_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '90 days'
           GROUP BY date_trunc('week', created_at)
           ORDER BY date`, [orgId]);
            rows = result.rows;
        }
        else {
            const interval = period === '30d' ? '30 days' : '7 days';
            const result = await (0, database_1.query)(`SELECT DATE(created_at) as date, COUNT(*) as count
           FROM contacts
           WHERE organization_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '${interval}'
           GROUP BY DATE(created_at)
           ORDER BY date`, [orgId]);
            rows = result.rows;
        }
        // Build a map for fast lookup
        const dataMap = new Map();
        for (const row of rows) {
            const key = typeof row.date === 'string'
                ? row.date.substring(0, 10)
                : new Date(row.date).toISOString().substring(0, 10);
            dataMap.set(key, parseInt(row.count, 10));
        }
        // Generate all date points in range, filling gaps with 0
        const points = [];
        const now = new Date();
        if (period === '90d') {
            // Weekly points
            const start = new Date(now);
            start.setDate(start.getDate() - 90);
            // align to Monday of start week
            const day = start.getDay();
            const diff = (day === 0 ? -6 : 1 - day);
            start.setDate(start.getDate() + diff);
            const cur = new Date(start);
            while (cur <= now) {
                const key = cur.toISOString().substring(0, 10);
                points.push({ date: key, count: dataMap.get(key) ?? 0 });
                cur.setDate(cur.getDate() + 7);
            }
        }
        else {
            const days = period === '30d' ? 30 : 7;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const key = d.toISOString().substring(0, 10);
                points.push({ date: key, count: dataMap.get(key) ?? 0 });
            }
        }
        res.json({ period, data: points });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/dashboard/top-agents
router.get('/top-agents', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const result = await (0, database_1.query)(`SELECT a.id, a.name, a.avatar_url, a.avatar_initials, a.status,
           COUNT(DISTINCT conv.id) as conversation_count,
           COUNT(DISTINCT co.id) as contact_count,
           COALESCE(ROUND(AVG(co.ai_score)::numeric, 1), NULL) as avg_score
         FROM agents a
         LEFT JOIN conversations conv ON conv.agent_id = a.id
         LEFT JOIN contacts co ON co.id = conv.contact_id
         WHERE a.organization_id = $1
         GROUP BY a.id
         ORDER BY conversation_count DESC
         LIMIT 5`, [orgId]);
        res.json({
            agents: result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                avatarUrl: row.avatar_url,
                avatarInitials: row.avatar_initials,
                status: row.status,
                conversationCount: parseInt(row.conversation_count, 10),
                contactCount: parseInt(row.contact_count, 10),
                avgScore: row.avg_score !== null ? parseFloat(row.avg_score) : null,
            })),
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/dashboard/funnel-overview
router.get('/funnel-overview', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const result = await (0, database_1.query)(`SELECT funnel_stage, COUNT(*) as count
         FROM contacts
         WHERE organization_id = $1
         GROUP BY funnel_stage`, [orgId]);
        const stageNames = ['lead', 'opportunity', 'customer'];
        const dataMap = new Map();
        for (const row of result.rows) {
            dataMap.set(row.funnel_stage, parseInt(row.count, 10));
        }
        const total = Array.from(dataMap.values()).reduce((a, b) => a + b, 0);
        const stages = stageNames.map((stage) => {
            const count = dataMap.get(stage) ?? 0;
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return { stage, count, percent };
        });
        res.json({ stages, total });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/dashboard/recent-leads
router.get('/recent-leads', auth_1.requireAuth, orgContext_1.orgContext, async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const result = await (0, database_1.query)(`SELECT c.id, c.name, c.email, c.ai_score, c.ai_service, c.created_at,
           COALESCE(a.name, conv_agent.name) as agent_name,
           COALESCE(a.id, conv_agent.id) as agent_id
         FROM contacts c
         LEFT JOIN agents a ON a.id = c.agent_id
         LEFT JOIN LATERAL (
           SELECT ag.id, ag.name
           FROM conversations conv
           JOIN agents ag ON ag.id = conv.agent_id
           WHERE conv.contact_id = c.id
           ORDER BY conv.created_at DESC
           LIMIT 1
         ) conv_agent ON true
         WHERE c.organization_id = $1 AND c.ai_score IS NOT NULL AND c.ai_score >= 5
         ORDER BY c.ai_score DESC, c.created_at DESC
         LIMIT 5`, [orgId]);
        res.json({
            leads: result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                email: row.email,
                score: row.ai_score,
                service: row.ai_service,
                createdAt: row.created_at,
                agentName: row.agent_name,
                agentId: row.agent_id,
            })),
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map