/**
 * Web widget human verification (Cloudflare Turnstile), one per session (web conversation).
 * POST /api/widget/:agentId/session/:sessionId/verify — routes/widget.ts wires the real deps.
 *
 * channel_metadata.human_verified_at is a reserved key (services/channel-metadata-keys.ts): this is
 * its only writer. Dropi web orders require it (fail-closed); the chat never does (fail-open).
 */
import { isUuid } from './widget-input';

export const VERIFY_LIMITS = {
  perIpPerHour: 20,
  perSessionPerHour: 5,
  windowSeconds: 3600,
  maxTokenLength: 2048,
} as const;

/** Every read and write filters by session id + agent id + web channel (cross-agent isolation). */
export const SQL_FIND_WEB_SESSION = `SELECT status, (channel_metadata->>'human_verified_at') IS NOT NULL AS verified
         FROM conversations
        WHERE id = $1 AND agent_id = $2 AND channel = 'web'`;

export const SQL_MARK_VERIFIED = `UPDATE conversations
          SET channel_metadata = COALESCE(channel_metadata, '{}'::jsonb) || jsonb_build_object('human_verified_at', NOW()),
              updated_at = NOW()
        WHERE id = $1 AND agent_id = $2 AND channel = 'web' AND status <> 'closed'`;

export interface WidgetVerifyDeps {
  /** INCR + EXPIRE on first hit; true while the count is within `max`. */
  hit: (key: string, max: number, windowSeconds: number) => Promise<boolean>;
  findSession: (sessionId: string, agentId: string) => Promise<{ status: string; verified: boolean } | null>;
  /** Returns the number of rows updated. */
  markVerified: (sessionId: string, agentId: string) => Promise<number>;
  verifyToken: (token: string, ip: string) => Promise<boolean>;
}

export type WidgetVerifyOutcome =
  | { kind: 'invalid' }
  | { kind: 'rate_limited' }
  | { kind: 'not_found' }
  | { kind: 'done'; verified: boolean };

export async function verifyWidgetSession(
  input: { agentId: string; sessionId: string; token: unknown; ip: string },
  deps: WidgetVerifyDeps
): Promise<WidgetVerifyOutcome> {
  const { agentId, sessionId, token, ip } = input;
  if (!isUuid(agentId) || !isUuid(sessionId)) return { kind: 'not_found' };
  if (typeof token !== 'string' || token.length === 0 || token.length > VERIFY_LIMITS.maxTokenLength) {
    return { kind: 'invalid' };
  }

  if (!(await deps.hit(`rl:widget:verify:ip:${ip}`, VERIFY_LIMITS.perIpPerHour, VERIFY_LIMITS.windowSeconds))) {
    return { kind: 'rate_limited' };
  }
  if (!(await deps.hit(`rl:widget:verify:session:${sessionId}`, VERIFY_LIMITS.perSessionPerHour, VERIFY_LIMITS.windowSeconds))) {
    return { kind: 'rate_limited' };
  }

  const session = await deps.findSession(sessionId, agentId);
  if (!session || session.status === 'closed') return { kind: 'not_found' };
  if (session.verified) return { kind: 'done', verified: true };

  // Single use: the token is sent to Cloudflare once and never stored or logged.
  if (!(await deps.verifyToken(token, ip))) return { kind: 'done', verified: false };

  const updated = await deps.markVerified(sessionId, agentId);
  return { kind: 'done', verified: updated > 0 };
}
