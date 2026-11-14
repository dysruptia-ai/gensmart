/**
 * Public OAuth callback for MCP providers (e.g. Dropi).
 *
 * GET /api/oauth/:providerId/callback?code&state[&error&error_description]
 *
 * There is no GenSmart session here (the browser comes back from the provider): security comes from
 * the single-use `state` stored in Redis (bound to org + agent + PKCE verifier). The handler ALWAYS
 * answers with a 302 to the frontend and never puts internal details in the URL.
 */
import { Router, Request, Response } from 'express';
import { rateLimiter } from '../middleware/rateLimiter';
import { env } from '../config/env';
import {
  completeAuthorization,
  consumeStateAgentId,
  McpOAuthStateError,
  McpOAuthCompletionError,
} from '../services/mcp-oauth.service';

const router = Router();

const callbackLimiter = rateLimiter({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'mcp-oauth-callback' });

const PROVIDER_PATTERN = /^[a-z0-9_-]{1,50}$/;

function redirectError(res: Response, providerId: string, reason: string, agentId?: string): void {
  const qs = new URLSearchParams({ mcp_oauth: 'error', provider: providerId, reason });
  const path = agentId ? `/dashboard/agents/${encodeURIComponent(agentId)}` : '/dashboard/agents';
  res.redirect(302, `${env.FRONTEND_URL}${path}?${qs.toString()}`);
}

router.get('/:providerId/callback', callbackLimiter, async (req: Request, res: Response): Promise<void> => {
  const providerId = String(req.params['providerId'] ?? '');
  const safeProvider = PROVIDER_PATTERN.test(providerId) ? providerId : 'unknown';
  const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
  const state = typeof req.query['state'] === 'string' ? req.query['state'] : '';
  const providerError = typeof req.query['error'] === 'string' ? req.query['error'] : '';

  try {
    if (!PROVIDER_PATTERN.test(providerId)) {
      redirectError(res, safeProvider, 'session_expired');
      return;
    }

    if (providerError) {
      // User cancelled/denied at the provider. Consume the state (single use) to recover the agent.
      const agentId = await consumeStateAgentId(state, providerId);
      console.warn(`[mcp-oauth] Authorization not granted for provider ${providerId} (error=${providerError.slice(0, 64)})`);
      redirectError(res, providerId, providerError === 'access_denied' ? 'access_denied' : 'provider_error', agentId);
      return;
    }

    if (!code || !state) {
      redirectError(res, providerId, 'session_expired');
      return;
    }

    const done = await completeAuthorization({ state, code, providerId });
    const qs = new URLSearchParams({ mcp_oauth: 'connected', provider: done.providerId });
    res.redirect(302, `${env.FRONTEND_URL}/dashboard/agents/${encodeURIComponent(done.agentId)}?${qs.toString()}`);
  } catch (err) {
    if (err instanceof McpOAuthStateError) {
      redirectError(res, safeProvider, 'session_expired');
    } else if (err instanceof McpOAuthCompletionError) {
      redirectError(res, safeProvider, err.reason, err.agentId);
    } else {
      console.error(`[mcp-oauth] Callback failed for provider ${safeProvider}:`, (err as Error).message);
      redirectError(res, safeProvider, 'server_error');
    }
  }
});

export default router;
