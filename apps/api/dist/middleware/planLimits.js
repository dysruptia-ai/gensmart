"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAgentLimit = checkAgentLimit;
exports.checkContactLimit = checkContactLimit;
exports.checkKnowledgeLimit = checkKnowledgeLimit;
exports.checkChannelAccess = checkChannelAccess;
exports.checkHumanTakeover = checkHumanTakeover;
exports.checkByoKeyAccess = checkByoKeyAccess;
exports.checkSubAccountLimit = checkSubAccountLimit;
const database_1 = require("../config/database");
const shared_1 = require("@gensmart/shared");
// ── Agent limit ────────────────────────────────────────────────────────────────
function checkAgentLimit() {
    return async (req, res, next) => {
        try {
            const plan = (req.org?.plan ?? 'free');
            const limit = shared_1.PLAN_LIMITS[plan]?.agents ?? 1;
            if (limit === Infinity) {
                next();
                return;
            }
            const result = await (0, database_1.query)("SELECT COUNT(*) as count FROM agents WHERE organization_id = $1 AND status != 'deleted'", [req.user.orgId]);
            const current = parseInt(result.rows[0]?.count ?? '0', 10);
            if (current >= limit) {
                res.status(403).json({
                    error: {
                        message: `Agent limit reached (${limit}). Upgrade your plan to create more agents.`,
                        code: 'PLAN_LIMIT_REACHED',
                        limit,
                        current,
                    },
                });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
// ── Contact limit ─────────────────────────────────────────────────────────────
function checkContactLimit() {
    return async (req, res, next) => {
        try {
            const plan = (req.org?.plan ?? 'free');
            const limit = shared_1.PLAN_LIMITS[plan]?.contacts ?? 25;
            if (limit === Infinity) {
                next();
                return;
            }
            const result = await (0, database_1.query)('SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1', [req.user.orgId]);
            const current = parseInt(result.rows[0]?.count ?? '0', 10);
            if (current >= limit) {
                res.status(403).json({
                    error: {
                        message: `Contact limit reached (${limit}). Upgrade your plan to add more contacts.`,
                        code: 'PLAN_LIMIT_REACHED',
                        limit,
                        current,
                    },
                });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
// ── Knowledge file limit ───────────────────────────────────────────────────────
function checkKnowledgeLimit() {
    return async (req, res, next) => {
        try {
            const plan = (req.org?.plan ?? 'free');
            const limit = shared_1.PLAN_LIMITS[plan]?.knowledgeFiles ?? 1;
            if (limit === Infinity) {
                next();
                return;
            }
            const orgResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM knowledge_files kf
         JOIN agents a ON kf.agent_id = a.id
         WHERE a.organization_id = $1 AND kf.status != 'deleted'`, [req.user.orgId]);
            const orgTotal = parseInt(orgResult.rows[0]?.count ?? '0', 10);
            if (orgTotal >= limit) {
                res.status(403).json({
                    error: {
                        message: `Knowledge file limit reached (${limit}). Upgrade your plan to add more files.`,
                        code: 'PLAN_LIMIT_REACHED',
                        limit,
                        current: orgTotal,
                    },
                });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
// ── Channel access (WhatsApp) ─────────────────────────────────────────────────
function checkChannelAccess(channel) {
    return async (req, res, next) => {
        try {
            const plan = (req.org?.plan ?? 'free');
            const allowedChannels = shared_1.PLAN_LIMITS[plan]?.channels;
            if (!allowedChannels.includes(channel)) {
                res.status(403).json({
                    error: {
                        message: `${channel} channel requires Starter plan or above. Upgrade to connect.`,
                        code: 'PLAN_LIMIT_REACHED',
                        requiredPlan: 'starter',
                    },
                });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
// ── Human takeover ────────────────────────────────────────────────────────────
function checkHumanTakeover() {
    return async (req, res, next) => {
        try {
            const plan = (req.org?.plan ?? 'free');
            const allowed = shared_1.PLAN_LIMITS[plan]?.humanTakeover ?? false;
            if (!allowed) {
                res.status(403).json({
                    error: {
                        message: 'Human takeover requires Starter plan or above. Upgrade to use this feature.',
                        code: 'PLAN_LIMIT_REACHED',
                        requiredPlan: 'starter',
                    },
                });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
// ── BYO Key access (Enterprise only) ─────────────────────────────────────────
function checkByoKeyAccess() {
    return async (req, res, next) => {
        try {
            const plan = (req.org?.plan ?? 'free');
            const allowed = shared_1.PLAN_LIMITS[plan]?.byoApiKey ?? false;
            if (!allowed) {
                res.status(403).json({
                    error: {
                        message: 'BYO API Key requires Enterprise plan.',
                        code: 'PLAN_LIMIT_REACHED',
                        requiredPlan: 'enterprise',
                    },
                });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
// ── Sub-account limit ─────────────────────────────────────────────────────────
function checkSubAccountLimit() {
    return async (req, res, next) => {
        try {
            const plan = (req.org?.plan ?? 'free');
            const limit = shared_1.PLAN_LIMITS[plan]?.subAccounts ?? 0;
            if (limit === 0) {
                res.status(403).json({
                    error: {
                        message: 'Sub-accounts require Pro plan or above.',
                        code: 'PLAN_LIMIT_REACHED',
                        requiredPlan: 'pro',
                    },
                });
                return;
            }
            if (limit === Infinity) {
                next();
                return;
            }
            const result = await (0, database_1.query)('SELECT COUNT(*) as count FROM sub_accounts WHERE parent_org_id = $1', [req.user.orgId]);
            const current = parseInt(result.rows[0]?.count ?? '0', 10);
            if (current >= limit) {
                res.status(403).json({
                    error: {
                        message: `Sub-account limit reached (${limit}). Upgrade to Enterprise for unlimited.`,
                        code: 'PLAN_LIMIT_REACHED',
                        limit,
                        current,
                    },
                });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
//# sourceMappingURL=planLimits.js.map