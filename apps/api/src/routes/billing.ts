import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validate } from '../middleware/validate';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { PLAN_LIMITS } from '@gensmart/shared';
import * as stripeService from '../services/stripe.service';
import { getMessageCount } from '../services/usage.service';

type PlanKey = keyof typeof PLAN_LIMITS;

const router = Router();

// ── All other billing routes require auth ──────────────────────────────────

router.use(requireAuth, orgContext);

// ── Schemas ────────────────────────────────────────────────────────────────

const createCheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'enterprise']),
  interval: z.enum(['monthly', 'quarterly', 'yearly']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const addonSchema = z.object({
  addon: z.enum(['messages_500', 'messages_2000', 'messages_5000']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// ── POST /api/billing/create-checkout ─────────────────────────────────────

router.post(
  '/create-checkout',
  validate(createCheckoutSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plan, interval, successUrl, cancelUrl } = req.body as z.infer<typeof createCheckoutSchema>;

      const orgResult = await query<{
        name: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
      }>(
        'SELECT name, stripe_customer_id, stripe_subscription_id FROM organizations WHERE id = $1',
        [req.user!.orgId]
      );
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
          const updated = await stripeService.updateSubscriptionPlan(
            org.stripe_subscription_id,
            itemId,
            priceId
          );
          res.json({ success: true, subscription: updated });
          return;
        }
      }

      // No existing subscription → create Stripe Checkout session
      const customerId = await stripeService.getOrCreateCustomer(
        req.user!.orgId,
        req.user!.email,
        org.name
      );

      const defaultSuccess = `${env.FRONTEND_URL}/dashboard/billing?success=1&plan=${plan}`;
      const defaultCancel = `${env.FRONTEND_URL}/dashboard/billing?cancelled=1`;

      const session = await stripeService.createCheckoutSession({
        orgId: req.user!.orgId,
        customerId,
        priceId,
        plan,
        interval,
        successUrl: successUrl ?? defaultSuccess,
        cancelUrl: cancelUrl ?? defaultCancel,
      });

      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/billing/create-portal ───────────────────────────────────────

router.post(
  '/create-portal',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgResult = await query<{ stripe_customer_id: string | null }>(
        'SELECT stripe_customer_id FROM organizations WHERE id = $1',
        [req.user!.orgId]
      );
      const customerId = orgResult.rows[0]?.stripe_customer_id;

      if (!customerId) {
        res.status(400).json({
          error: { message: 'No billing account found. Please subscribe to a plan first.', code: 'NO_CUSTOMER' },
        });
        return;
      }

      const returnUrl = `${env.FRONTEND_URL}/dashboard/billing`;
      const session = await stripeService.createPortalSession(customerId, returnUrl);
      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/billing/subscription ─────────────────────────────────────────

router.get(
  '/subscription',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgResult = await query<{
        plan: string;
        stripe_subscription_id: string | null;
        subscription_status: string;
        current_period_start: string | null;
        current_period_end: string | null;
        stripe_customer_id: string | null;
      }>(
        `SELECT plan, stripe_subscription_id, subscription_status,
                current_period_start, current_period_end, stripe_customer_id
         FROM organizations WHERE id = $1`,
        [req.user!.orgId]
      );
      const org = orgResult.rows[0];
      if (!org) {
        res.status(404).json({ error: { message: 'Organization not found', code: 'NOT_FOUND' } });
        return;
      }

      let cancelAtPeriodEnd = false;
      let interval: string | null = null;

      if (org.stripe_subscription_id) {
        try {
          const sub = await stripeService.getSubscription(org.stripe_subscription_id);
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          interval = sub.items.data[0]?.plan?.interval ?? null;
        } catch {
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
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/billing/invoices ──────────────────────────────────────────────

router.get(
  '/invoices',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgResult = await query<{ stripe_customer_id: string | null }>(
        'SELECT stripe_customer_id FROM organizations WHERE id = $1',
        [req.user!.orgId]
      );
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
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/billing/usage ─────────────────────────────────────────────────

router.get(
  '/usage',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user!.orgId;
      const plan = req.org!.plan as PlanKey;
      const limits = PLAN_LIMITS[plan];

      // Messages (Redis)
      const messagesUsed = await getMessageCount(orgId);
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const addonKey = `usage:${orgId}:${yearMonth}:addon_messages`;
      const addonMessages = parseInt((await redis.get(addonKey)) ?? '0', 10);
      const messagesLimit = limits.messagesPerMonth + addonMessages;
      const messagesPercent = messagesLimit === Infinity
        ? 0
        : Math.round((messagesUsed / messagesLimit) * 100);

      // Agents count
      const agentsResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM agents WHERE organization_id = $1 AND status != $2',
        [orgId, 'deleted']
      );
      const agentsUsed = parseInt(agentsResult.rows[0]?.count ?? '0', 10);
      const agentsLimit = limits.agents;

      // Contacts count
      const contactsResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1',
        [orgId]
      );
      const contactsUsed = parseInt(contactsResult.rows[0]?.count ?? '0', 10);
      const contactsLimit = limits.contacts;

      // Knowledge files count
      const filesResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM knowledge_files kf
         JOIN agents a ON kf.agent_id = a.id
         WHERE a.organization_id = $1`,
        [orgId]
      );
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
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/billing/addon ────────────────────────────────────────────────

router.post(
  '/addon',
  validate(addonSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { addon, successUrl, cancelUrl } = req.body as z.infer<typeof addonSchema>;

      const orgResult = await query<{ name: string; stripe_customer_id: string | null }>(
        'SELECT name, stripe_customer_id FROM organizations WHERE id = $1',
        [req.user!.orgId]
      );
      const org = orgResult.rows[0];
      if (!org) {
        res.status(404).json({ error: { message: 'Organization not found', code: 'NOT_FOUND' } });
        return;
      }

      const customerId = await stripeService.getOrCreateCustomer(
        req.user!.orgId,
        req.user!.email,
        org.name
      );

      const defaultSuccess = `${env.FRONTEND_URL}/dashboard/billing?addon_success=1`;
      const defaultCancel = `${env.FRONTEND_URL}/dashboard/billing`;

      const session = await stripeService.createAddOnCheckout({
        customerId,
        addon,
        orgId: req.user!.orgId,
        successUrl: successUrl ?? defaultSuccess,
        cancelUrl: cancelUrl ?? defaultCancel,
      });

      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  }
);


export default router;
