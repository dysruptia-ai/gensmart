"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orgContext = orgContext;
const database_1 = require("../config/database");
async function orgContext(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
        return;
    }
    try {
        const result = await (0, database_1.query)('SELECT id, name, slug, plan, subscription_status FROM organizations WHERE id = $1', [req.user.orgId]);
        if (!result.rows[0]) {
            res.status(404).json({ error: { message: 'Organization not found', code: 'ORG_NOT_FOUND' } });
            return;
        }
        req.org = result.rows[0];
        next();
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=orgContext.js.map