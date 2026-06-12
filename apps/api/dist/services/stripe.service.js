"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomer = createCustomer;
exports.getOrCreateCustomer = getOrCreateCustomer;
exports.updateCustomerEmail = updateCustomerEmail;
exports.createCheckoutSession = createCheckoutSession;
exports.createPortalSession = createPortalSession;
exports.getSubscription = getSubscription;
exports.cancelSubscription = cancelSubscription;
exports.updateSubscriptionPlan = updateSubscriptionPlan;
exports.createAddOnCheckout = createAddOnCheckout;
exports.getInvoices = getInvoices;
exports.getPricesForPlan = getPricesForPlan;
exports.getAddonPrices = getAddonPrices;
exports.constructWebhookEvent = constructWebhookEvent;
exports.saveBillingEvent = saveBillingEvent;
exports.updateOrgSubscription = updateOrgSubscription;
exports.downgradeOrgToFree = downgradeOrgToFree;
exports.handleWebhookEvent = handleWebhookEvent;
const stripe_1 = require("../config/stripe");
const env_1 = require("../config/env");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const websocket_1 = require("../config/websocket");
function getPriceId(plan, interval) {
    const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
    return env_1.env[key] ?? '';
}
function getAddonPriceId(addon) {
    const map = {
        messages_500: env_1.env.STRIPE_PRICE_ADDON_500,
        messages_2000: env_1.env.STRIPE_PRICE_ADDON_2000,
        messages_5000: env_1.env.STRIPE_PRICE_ADDON_5000,
    };
    return map[addon] ?? '';
}
// ── Customer management ───────────────────────────────────────────────────────
async function createCustomer(orgId, email, name) {
    const customer = await stripe_1.stripe.customers.create({
        email,
        name,
        metadata: { orgId },
    });
    await (0, database_1.query)('UPDATE organizations SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2', [customer.id, orgId]);
    return customer;
}
async function getOrCreateCustomer(orgId, email, name) {
    const result = await (0, database_1.query)('SELECT stripe_customer_id FROM organizations WHERE id = $1', [orgId]);
    const existing = result.rows[0]?.stripe_customer_id;
    if (existing)
        return existing;
    const customer = await createCustomer(orgId, email, name);
    return customer.id;
}
async function updateCustomerEmail(customerId, email) {
    await stripe_1.stripe.customers.update(customerId, { email });
}
// ── Checkout & portal ─────────────────────────────────────────────────────────
async function createCheckoutSession(params) {
    return stripe_1.stripe.checkout.sessions.create({
        customer: params.customerId,
        mode: 'subscription',
        line_items: [{ price: params.priceId, quantity: 1 }],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        metadata: {
            orgId: params.orgId,
            plan: params.plan,
            interval: params.interval,
            type: 'subscription',
        },
        subscription_data: {
            metadata: {
                orgId: params.orgId,
                plan: params.plan,
                interval: params.interval,
            },
        },
    });
}
async function createPortalSession(customerId, returnUrl) {
    return stripe_1.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
}
// ── Subscription management ───────────────────────────────────────────────────
async function getSubscription(subscriptionId) {
    return stripe_1.stripe.subscriptions.retrieve(subscriptionId);
}
async function cancelSubscription(subscriptionId) {
    return stripe_1.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
    });
}
async function updateSubscriptionPlan(subscriptionId, itemId, newPriceId) {
    return stripe_1.stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: newPriceId }],
        proration_behavior: 'create_prorations',
    });
}
// ── Add-on payments ───────────────────────────────────────────────────────────
async function createAddOnCheckout(params) {
    const priceId = getAddonPriceId(params.addon);
    if (!priceId || priceId === 'price_placeholder') {
        throw new Error('Add-on price ID not configured. Run: npm run stripe:seed --workspace=apps/api');
    }
    const addonMessages = {
        messages_500: 500,
        messages_2000: 2000,
        messages_5000: 5000,
    };
    return stripe_1.stripe.checkout.sessions.create({
        customer: params.customerId,
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
            orgId: params.orgId,
            type: 'addon',
            addon: params.addon,
            messageCount: String(addonMessages[params.addon]),
        },
    });
}
// ── Invoice history ───────────────────────────────────────────────────────────
async function getInvoices(customerId, limit = 20) {
    const invoices = await stripe_1.stripe.invoices.list({
        customer: customerId,
        limit,
        expand: ['data.subscription'],
    });
    return invoices.data;
}
// ── Price resolution (for frontend) ──────────────────────────────────────────
function getPricesForPlan(plan) {
    return {
        monthly: getPriceId(plan, 'monthly'),
        quarterly: getPriceId(plan, 'quarterly'),
        yearly: getPriceId(plan, 'yearly'),
    };
}
function getAddonPrices() {
    return {
        messages_500: env_1.env.STRIPE_PRICE_ADDON_500,
        messages_2000: env_1.env.STRIPE_PRICE_ADDON_2000,
        messages_5000: env_1.env.STRIPE_PRICE_ADDON_5000,
    };
}
// ── Webhook helpers ───────────────────────────────────────────────────────────
function constructWebhookEvent(payload, signature) {
    return stripe_1.stripe.webhooks.constructEvent(payload, signature, env_1.env.STRIPE_WEBHOOK_SECRET);
}
async function saveBillingEvent(orgId, stripeEventId, eventType, amount, metadata) {
    try {
        await (0, database_1.query)(`INSERT INTO billing_events (organization_id, stripe_event_id, event_type, amount, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (stripe_event_id) DO NOTHING`, [orgId, stripeEventId, eventType, amount, JSON.stringify(metadata)]);
        return true;
    }
    catch {
        return false;
    }
}
async function updateOrgSubscription(params) {
    await (0, database_1.query)(`UPDATE organizations
     SET plan = $1,
         stripe_subscription_id = $2,
         subscription_status = $3,
         current_period_start = $4,
         current_period_end = $5,
         updated_at = NOW()
     WHERE id = $6`, [
        params.plan,
        params.subscriptionId,
        params.status,
        params.periodStart?.toISOString() ?? null,
        params.periodEnd?.toISOString() ?? null,
        params.orgId,
    ]);
}
async function downgradeOrgToFree(orgId) {
    await (0, database_1.query)(`UPDATE organizations
     SET plan = 'free',
         stripe_subscription_id = NULL,
         subscription_status = 'canceled',
         current_period_start = NULL,
         current_period_end = NULL,
         updated_at = NOW()
     WHERE id = $1`, [orgId]);
}
// ── Webhook event processing ──────────────────────────────────────────────────
async function handleWebhookEvent(event) {
    // Idempotency: skip events already recorded
    const existing = await (0, database_1.query)('SELECT id FROM billing_events WHERE stripe_event_id = $1', [event.id]);
    if (existing.rows.length > 0) {
        console.log(`[webhook] Event ${event.id} already processed, skipping`);
        return;
    }
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const orgId = session.metadata?.['orgId'];
            const type = session.metadata?.['type'];
            if (!orgId)
                return;
            if (type === 'addon') {
                const addonStr = session.metadata?.['addon'];
                const messageCount = parseInt(session.metadata?.['messageCount'] ?? '0', 10);
                if (addonStr && messageCount > 0) {
                    const now = new Date();
                    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    const addonKey = `usage:${orgId}:${yearMonth}:addon_messages`;
                    await redis_1.redis.incrby(addonKey, messageCount);
                    await redis_1.redis.expire(addonKey, 45 * 24 * 60 * 60);
                    console.log(`[webhook] Added ${messageCount} addon messages for org ${orgId}`);
                    try {
                        (0, websocket_1.getIO)().to(`org:${orgId}`).emit('billing:addon_applied', { addon: addonStr, messageCount });
                    }
                    catch { /* ignore */ }
                }
                await saveBillingEvent(orgId, event.id, event.type, session.amount_total, { addon: addonStr, sessionId: session.id });
                return;
            }
            if (type === 'subscription') {
                const plan = session.metadata?.['plan'] ?? 'starter';
                const interval = session.metadata?.['interval'] ?? 'monthly';
                const subscriptionId = typeof session.subscription === 'string'
                    ? session.subscription
                    : session.subscription?.id;
                if (subscriptionId) {
                    try {
                        const sub = await getSubscription(subscriptionId);
                        const item = sub.items.data[0];
                        const periodStartTs = item?.current_period_start ?? sub.billing_cycle_anchor;
                        const periodEndTs = item?.current_period_end;
                        await updateOrgSubscription({
                            orgId, plan, subscriptionId,
                            status: sub.status,
                            periodStart: new Date(periodStartTs * 1000),
                            periodEnd: periodEndTs ? new Date(periodEndTs * 1000) : null,
                        });
                        console.log(`[webhook] Subscription created: org=${orgId} plan=${plan}`);
                        try {
                            (0, websocket_1.getIO)().to(`org:${orgId}`).emit('billing:subscription_updated', { plan, status: sub.status });
                        }
                        catch { /* ignore */ }
                    }
                    catch (err) {
                        console.error('[webhook] Error fetching subscription:', err);
                    }
                }
                await saveBillingEvent(orgId, event.id, event.type, session.amount_total, { plan, interval, sessionId: session.id });
            }
            break;
        }
        case 'customer.subscription.updated': {
            const sub = event.data.object;
            const orgId = sub.metadata?.['orgId'];
            if (!orgId)
                return;
            const plan = sub.metadata?.['plan'] ?? 'starter';
            const item = sub.items.data[0];
            const periodStartTs = item?.current_period_start ?? sub.billing_cycle_anchor;
            const periodEndTs = item?.current_period_end;
            await updateOrgSubscription({
                orgId, plan, subscriptionId: sub.id, status: sub.status,
                periodStart: new Date(periodStartTs * 1000),
                periodEnd: periodEndTs ? new Date(periodEndTs * 1000) : null,
            });
            await saveBillingEvent(orgId, event.id, event.type, null, { plan, status: sub.status });
            try {
                (0, websocket_1.getIO)().to(`org:${orgId}`).emit('billing:subscription_updated', { plan, status: sub.status });
            }
            catch { /* ignore */ }
            break;
        }
        case 'customer.subscription.deleted': {
            const sub = event.data.object;
            const orgId = sub.metadata?.['orgId'];
            if (!orgId)
                return;
            await downgradeOrgToFree(orgId);
            await saveBillingEvent(orgId, event.id, event.type, null, { reason: 'subscription_deleted' });
            console.log(`[webhook] Subscription deleted — org ${orgId} downgraded to free`);
            try {
                (0, websocket_1.getIO)().to(`org:${orgId}`).emit('billing:subscription_updated', { plan: 'free', status: 'canceled' });
            }
            catch { /* ignore */ }
            break;
        }
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object;
            const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
            if (!customerId)
                return;
            const orgResult = await (0, database_1.query)('SELECT id FROM organizations WHERE stripe_customer_id = $1', [customerId]);
            const orgId = orgResult.rows[0]?.id;
            if (!orgId)
                return;
            await saveBillingEvent(orgId, event.id, event.type, invoice.amount_paid, { invoiceId: invoice.id, invoiceNumber: invoice.number });
            break;
        }
        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
            if (!customerId)
                return;
            const orgResult = await (0, database_1.query)('SELECT id FROM organizations WHERE stripe_customer_id = $1', [customerId]);
            const orgId = orgResult.rows[0]?.id;
            if (!orgId)
                return;
            await (0, database_1.query)('UPDATE organizations SET subscription_status = $1, updated_at = NOW() WHERE id = $2', ['past_due', orgId]);
            await saveBillingEvent(orgId, event.id, event.type, invoice.amount_due, { invoiceId: invoice.id });
            try {
                (0, websocket_1.getIO)().to(`org:${orgId}`).emit('billing:payment_failed', { message: 'Your payment failed. Please update your payment method.' });
            }
            catch { /* ignore */ }
            break;
        }
        default:
            console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
}
//# sourceMappingURL=stripe.service.js.map