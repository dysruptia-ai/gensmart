"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const orgContext_1 = require("../middleware/orgContext");
const validate_1 = require("../middleware/validate");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const env_1 = require("../config/env");
const shared_1 = require("@gensmart/shared");
const stripeService = __importStar(require("../services/stripe.service"));
const usage_service_1 = require("../services/usage.service");
const router = (0, express_1.Router)();
// ── All other billing routes require auth ──────────────────────────────────
router.use(auth_1.requireAuth, orgContext_1.orgContext);
// ── Schemas ────────────────────────────────────────────────────────────────
const createCheckoutSchema = zod_1.z.object({
    plan: zod_1.z.enum(['starter', 'pro', 'enterprise']),
    interval: zod_1.z.enum(['monthly', 'quarterly', 'yearly']),
    successUrl: zod_1.z.string().url().optional(),
    cancelUrl: zod_1.z.string().url().optional(),
});
const addonSchema = zod_1.z.object({
    addon: zod_1.z.enum(['messages_500', 'messages_2000', 'messages_5000']),
    successUrl: zod_1.z.string().url().optional(),
    cancelUrl: zod_1.z.string().url().optional(),
});
// ── POST /api/billing/create-checkout ─────────────────────────────────────
router.post('/create-checkout', (0, validate_1.validate)(createCheckoutSchema), async (req, res, next) => {
    try {
        const { plan, interval, successUrl, cancelUrl } = req.body;
        const orgResult = await (0, database_1.query)('SELECT name, stripe_customer_id, stripe_subscription_id FROM organizations WHERE id = $1', [req.user.orgId]);
        const org = orgResult.rows[0];
        if (!org) {
            res.status(404).json({ error: { message: 'Organization not found', code: 'NOT_FOUND' } });
            return;
        }
        const priceId = stripeService.getPricesForPlan(plan)[interval];
        if (!priceId || priceId === 'price_placeholder') {
            res.status(503).json({
                error: {
                    message: 'Billing not fully configured. Run stripe:seed first.',
                    code: 'STRIPE_NOT_CONFIGURED',
                },
            });
            return;
        }
        // If org already has an active subscription → update it (no new checkout)
        if (org.stripe_subscription_id) {
            const subscription = await stripeService.getSubscription(org.stripe_subscription_id);
            const itemId = subscription.items.data[0]?.id;
            if (itemId) {
                const updated = await stripeService.updateSubscriptionPlan(org.stripe_subscription_id, itemId, priceId);
                res.json({ success: true, subscription: updated });
                return;
            }
        }
        // No existing subscription → create Stripe Checkout session
        const customerId = await stripeService.getOrCreateCustomer(req.user.orgId, req.user.email, org.name);
        const defaultSuccess = `${env_1.env.FRONTEND_URL}/dashboard/billing?success=1&plan=${plan}`;
        const defaultCancel = `${env_1.env.FRONTEND_URL}/dashboard/billing?cancelled=1`;
        const session = await stripeService.createCheckoutSession({
            orgId: req.user.orgId,
            customerId,
            priceId,
            plan,
            interval,
            successUrl: successUrl ?? defaultSuccess,
            cancelUrl: cancelUrl ?? defaultCancel,
        });
        res.json({ url: session.url });
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/billing/create-portal ───────────────────────────────────────
router.post('/create-portal', async (req, res, next) => {
    try {
        const orgResult = await (0, database_1.query)('SELECT stripe_customer_id FROM organizations WHERE id = $1', [req.user.orgId]);
        const customerId = orgResult.rows[0]?.stripe_customer_id;
        if (!customerId) {
            res.status(400).json({
                error: { message: 'No billing account found. Please subscribe to a plan first.', code: 'NO_CUSTOMER' },
            });
            return;
        }
        const returnUrl = `${env_1.env.FRONTEND_URL}/dashboard/billing`;
        const session = await stripeService.createPortalSession(customerId, returnUrl);
        res.json({ url: session.url });
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/billing/subscription ─────────────────────────────────────────
router.get('/subscription', async (req, res, next) => {
    try {
        const orgResult = await (0, database_1.query)(`SELECT plan, stripe_subscription_id, subscription_status,
                current_period_start, current_period_end, stripe_customer_id
         FROM organizations WHERE id = $1`, [req.user.orgId]);
        const org = orgResult.rows[0];
        if (!org) {
            res.status(404).json({ error: { message: 'Organization not found', code: 'NOT_FOUND' } });
            return;
        }
        let cancelAtPeriodEnd = false;
        let interval = null;
        if (org.stripe_subscription_id) {
            try {
                const sub = await stripeService.getSubscription(org.stripe_subscription_id);
                cancelAtPeriodEnd = sub.cancel_at_period_end;
                interval = sub.items.data[0]?.plan?.interval ?? null;
            }
            catch {
                // Subscription might not exist in Stripe — ignore
            }
        }
        res.json({
            plan: org.plan,
            status: org.subscription_status,
            subscriptionId: org.stripe_subscription_id,
            customerId: org.stripe_customer_id,
            currentPeriodStart: org.current_period_start,
            currentPeriodEnd: org.current_period_end,
            cancelAtPeriodEnd,
            interval,
        });
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/billing/invoices ──────────────────────────────────────────────
router.get('/invoices', async (req, res, next) => {
    try {
        const orgResult = await (0, database_1.query)('SELECT stripe_customer_id FROM organizations WHERE id = $1', [req.user.orgId]);
        const customerId = orgResult.rows[0]?.stripe_customer_id;
        if (!customerId) {
            res.json({ invoices: [] });
            return;
        }
        const invoices = await stripeService.getInvoices(customerId, 20);
        res.json({
            invoices: invoices.map((inv) => ({
                id: inv.id,
                number: inv.number,
                amount: inv.amount_paid,
                currency: inv.currency,
                status: inv.status,
                description: inv.description,
                created: inv.created,
                periodStart: inv.period_start,
                periodEnd: inv.period_end,
                pdfUrl: inv.invoice_pdf,
                hostedUrl: inv.hosted_invoice_url,
            })),
        });
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/billing/usage ─────────────────────────────────────────────────
router.get('/usage', async (req, res, next) => {
    try {
        const orgId = req.user.orgId;
        const plan = req.org.plan;
        const limits = shared_1.PLAN_LIMITS[plan];
        // Messages (Redis)
        const messagesUsed = await (0, usage_service_1.getMessageCount)(orgId);
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const addonKey = `usage:${orgId}:${yearMonth}:addon_messages`;
        const addonMessages = parseInt((await redis_1.redis.get(addonKey)) ?? '0', 10);
        const messagesLimit = limits.messagesPerMonth + addonMessages;
        const messagesPercent = messagesLimit === Infinity
            ? 0
            : Math.round((messagesUsed / messagesLimit) * 100);
        // Agents count
        const agentsResult = await (0, database_1.query)('SELECT COUNT(*) as count FROM agents WHERE organization_id = $1 AND status != $2', [orgId, 'deleted']);
        const agentsUsed = parseInt(agentsResult.rows[0]?.count ?? '0', 10);
        const agentsLimit = limits.agents;
        // Contacts count
        const contactsResult = await (0, database_1.query)('SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1', [orgId]);
        const contactsUsed = parseInt(contactsResult.rows[0]?.count ?? '0', 10);
        const contactsLimit = limits.contacts;
        // Knowledge files count
        const filesResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM knowledge_files kf
         JOIN agents a ON kf.agent_id = a.id
         WHERE a.organization_id = $1`, [orgId]);
        const filesUsed = parseInt(filesResult.rows[0]?.count ?? '0', 10);
        const filesLimit = limits.knowledgeFiles;
        res.json({
            messages: {
                used: messagesUsed,
                limit: messagesLimit === Infinity ? null : messagesLimit,
                percent: messagesPercent,
                addonMessages,
            },
            agents: {
                used: agentsUsed,
                limit: agentsLimit === Infinity ? null : agentsLimit,
                percent: agentsLimit === Infinity ? 0 : Math.round((agentsUsed / agentsLimit) * 100),
            },
            contacts: {
                used: contactsUsed,
                limit: contactsLimit === Infinity ? null : contactsLimit,
                percent: contactsLimit === Infinity ? 0 : Math.round((contactsUsed / contactsLimit) * 100),
            },
            knowledgeFiles: {
                used: filesUsed,
                limit: filesLimit === Infinity ? null : filesLimit,
                percent: filesLimit === Infinity ? 0 : Math.round((filesUsed / filesLimit) * 100),
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/billing/addon ────────────────────────────────────────────────
router.post('/addon', (0, validate_1.validate)(addonSchema), async (req, res, next) => {
    try {
        const { addon, successUrl, cancelUrl } = req.body;
        const orgResult = await (0, database_1.query)('SELECT name, stripe_customer_id FROM organizations WHERE id = $1', [req.user.orgId]);
        const org = orgResult.rows[0];
        if (!org) {
            res.status(404).json({ error: { message: 'Organization not found', code: 'NOT_FOUND' } });
            return;
        }
        const customerId = await stripeService.getOrCreateCustomer(req.user.orgId, req.user.email, org.name);
        const defaultSuccess = `${env_1.env.FRONTEND_URL}/dashboard/billing?addon_success=1`;
        const defaultCancel = `${env_1.env.FRONTEND_URL}/dashboard/billing`;
        const session = await stripeService.createAddOnCheckout({
            customerId,
            addon,
            orgId: req.user.orgId,
            successUrl: successUrl ?? defaultSuccess,
            cancelUrl: cancelUrl ?? defaultCancel,
        });
        res.json({ url: session.url });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=billing.js.map