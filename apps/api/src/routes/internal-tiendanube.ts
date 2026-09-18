/**
 * Internal endpoints hit by tiendanube-mcp, not by a logged-in GenSmart user
 * — there is no session at install/webhook time, only a shared secret.
 *
 * - POST /provision: right after tiendanube-mcp resolves a store's OAuth
 *   install on its own side (see migration 047_tiendanube-mcp.sql — the
 *   access token itself never reaches GenSmart). Triggers the Dia 3
 *   auto-provisioning sequence: User+Org, magic-link email, Agent from
 *   template, MCP connection.
 * - POST /toggle-tool: on app/suspended|resumed|uninstalled webhooks (Dia 6,
 *   built in parallel). Enables/disables the tiendanube MCP tool without
 *   touching the Organization itself.
 *
 * Auth: shared secret in X-MCP-API-Key, same platform_settings key
 * (`tiendanube_mcp_api_key`) already used in the other direction (GenSmart
 * -> tiendanube-mcp, migration 047 auto_injected_headers). Not mounted under
 * requireAuth/orgContext — there is no GenSmart session in either case.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  provisionTiendanubeStore,
  toggleTiendanubeTool,
  markTiendanubeCustomer,
  verifyInternalProvisioningSecret,
} from '../services/tiendanube-provisioning.service';

const router = Router();

const provisionLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'tiendanube-provision' });
const toggleToolLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'tiendanube-toggle-tool' });
const markCustomerLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'tiendanube-mark-customer' });

const provisionSchema = z.object({
  storeId: z.string().min(1),
  storeName: z.string().min(1).max(255),
  email: z.string().email(),
  contactName: z.string().min(1).max(255),
});

const toggleToolSchema = z.object({
  storeId: z.string().min(1),
  enabled: z.boolean(),
});

const markCustomerSchema = z
  .object({
    storeId: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: 'At least one of email or phone is required',
  });

router.post(
  '/provision',
  provisionLimiter,
  validate(provisionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const providedKey = req.headers['x-mcp-api-key'] as string | undefined;
      const isValid = await verifyInternalProvisioningSecret(providedKey);
      if (!isValid) {
        res.status(401).json({ error: { message: 'Invalid or missing X-MCP-API-Key', code: 'UNAUTHORIZED' } });
        return;
      }

      const result = await provisionTiendanubeStore(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Called by tiendanube-mcp on app/suspended|resumed|uninstalled webhooks
// (Dia 6, built in parallel) to reflect that state onto the tiendanube MCP
// tool without touching the Organization itself.
router.post(
  '/toggle-tool',
  toggleToolLimiter,
  validate(toggleToolSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const providedKey = req.headers['x-mcp-api-key'] as string | undefined;
      const isValid = await verifyInternalProvisioningSecret(providedKey);
      if (!isValid) {
        res.status(401).json({ error: { message: 'Invalid or missing X-MCP-API-Key', code: 'UNAUTHORIZED' } });
        return;
      }

      const result = await toggleTiendanubeTool(req.body.storeId, req.body.enabled);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Called by tiendanube-mcp on order/paid webhooks — moves the matching
// Contact to funnel_stage='customer'. GenSmart does not store the order
// itself; Tiendanube stays the system of record for the sale.
router.post(
  '/mark-customer',
  markCustomerLimiter,
  validate(markCustomerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const providedKey = req.headers['x-mcp-api-key'] as string | undefined;
      const isValid = await verifyInternalProvisioningSecret(providedKey);
      if (!isValid) {
        res.status(401).json({ error: { message: 'Invalid or missing X-MCP-API-Key', code: 'UNAUTHORIZED' } });
        return;
      }

      const result = await markTiendanubeCustomer(req.body.storeId, req.body.email, req.body.phone);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
