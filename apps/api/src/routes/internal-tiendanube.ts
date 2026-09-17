/**
 * Internal endpoint hit by tiendanube-mcp right after it resolves a store's
 * OAuth install on its own side (see migration 047_tiendanube-mcp.sql — the
 * access token itself never reaches GenSmart). Triggers the Dia 3
 * auto-provisioning sequence: User+Org, magic-link email, Agent from
 * template, MCP connection.
 *
 * Auth: shared secret in X-MCP-API-Key, same platform_settings key
 * (`tiendanube_mcp_api_key`) already used in the other direction (GenSmart
 * -> tiendanube-mcp, migration 047 auto_injected_headers). Not mounted under
 * requireAuth/orgContext — there is no GenSmart session at install time.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  provisionTiendanubeStore,
  verifyInternalProvisioningSecret,
} from '../services/tiendanube-provisioning.service';

const router = Router();

const provisionLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'tiendanube-provision' });

const provisionSchema = z.object({
  storeId: z.string().min(1),
  storeName: z.string().min(1).max(255),
  email: z.string().email(),
  contactName: z.string().min(1).max(255),
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

export default router;
