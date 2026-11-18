import { env } from '../config/env';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Verifies a Cloudflare Turnstile token against Cloudflare's siteverify endpoint.
 * Fails closed: any network/parsing error, or a missing secret key, returns false
 * (never lets a request through when verification couldn't be completed).
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY is not configured: refusing verification');
    return false;
  }

  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    if (remoteIp) body.append('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) return false;

    const data = (await res.json()) as TurnstileVerifyResponse;
    return data.success === true;
  } catch (err) {
    console.error('[turnstile] verification request failed:', err);
    return false;
  }
}

// ── Web widget: per-session human verification ───────────────────────────────

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const WIDGET_TURNSTILE_ACTION = 'widget_session';
const WIDGET_VERIFY_TIMEOUT_MS = 5000;
const PRODUCTION_HOSTNAMES: readonly string[] = ['www.gensmart.co', 'gensmart.co'];
const DEVELOPMENT_HOSTNAMES: readonly string[] = ['localhost', '127.0.0.1'];

interface SiteverifyResult {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
}

/** Hostnames a widget token may have been solved on: the iframe origin (www.gensmart.co). */
export function allowedTurnstileHostnames(nodeEnv: string): readonly string[] {
  return nodeEnv === 'development' ? [...PRODUCTION_HOSTNAMES, ...DEVELOPMENT_HOSTNAMES] : PRODUCTION_HOSTNAMES;
}

export interface StrictTurnstileOptions {
  /** Expected `action` of the siteverify answer (the widget's render option). */
  expectedAction: string;
  /** Defaults to allowedTurnstileHostnames(env.NODE_ENV). */
  allowedHostnames?: readonly string[];
  /** Test seams; production uses the real secret, global fetch and a 5 s timeout. */
  secret?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  log?: { warn: (msg: string) => void };
}

let missingSecretWarned = false;

/**
 * Strict Turnstile check for the web widget: success, action and hostname must all match.
 * Never throws: a missing secret, timeout, network/HTTP/parse error or any mismatch → false.
 * Logs neither the token nor the secret (only the reason).
 */
export async function verifyTurnstileTokenStrict(
  token: string,
  remoteIp: string | undefined,
  opts: StrictTurnstileOptions
): Promise<boolean> {
  const secret = opts.secret ?? env.TURNSTILE_SECRET_KEY;
  const log = opts.log ?? console;
  if (!secret) {
    if (!missingSecretWarned) {
      missingSecretWarned = true;
      log.warn('[turnstile] TURNSTILE_SECRET_KEY is not configured: widget sessions cannot be verified');
    }
    return false;
  }
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

  const allowed = opts.allowedHostnames ?? allowedTurnstileHostnames(env.NODE_ENV);
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') body.append('remoteip', remoteIp);

    const res = await doFetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(opts.timeoutMs ?? WIDGET_VERIFY_TIMEOUT_MS),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as SiteverifyResult;
    return (
      data !== null &&
      typeof data === 'object' &&
      data.success === true &&
      data.action === opts.expectedAction &&
      typeof data.hostname === 'string' &&
      allowed.includes(data.hostname.toLowerCase())
    );
  } catch (err) {
    log.warn(`[turnstile] widget verification failed: ${(err as Error).name}`);
    return false;
  }
}

/** Test only: lets the "warn once" behaviour be observed again. */
export function resetTurnstileWarningsForTests(): void {
  missingSecretWarned = false;
}
