import crypto from 'crypto';
import net from 'net';
import { AppError } from '../middleware/errorHandler';

/**
 * Counters of failed attempts (logins, 2FA codes, password checks) kept in Redis.
 * Fixed window: the TTL starts with the first failure.
 */

export interface AttemptStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
  /** Remaining seconds: -1 when the key has no expiry, -2 when it does not exist (Redis TTL). */
  ttl(key: string): Promise<number>;
}

async function defaultStore(): Promise<AttemptStore> {
  // Lazy: importing this module must not open a Redis connection
  return (await import('../config/redis')).redis as unknown as AttemptStore;
}

export const ATTEMPT_LIMITS = {
  loginPerEmailAndIp: { max: 5, windowSeconds: 15 * 60 },
  loginPerEmail: { max: 20, windowSeconds: 60 * 60 },
  twoFactorPerUser: { max: 5, windowSeconds: 5 * 60 },
  passwordPerUser: { max: 5, windowSeconds: 15 * 60 },
  forgotPasswordPerEmail: { max: 3, windowSeconds: 60 * 60 },
} as const;

/** Blocked once the number of failures reaches the maximum. */
export function isBlocked(count: number, max: number): boolean {
  return count >= max;
}

/** Joins the parts with ":"; emails and IP addresses are hashed so they never sit in clear text in Redis. */
export function buildAttemptKey(parts: string[]): string {
  return (
    'attempts:' +
    parts
      .map((part) =>
        part.includes('@') || net.isIP(part)
          ? crypto.createHash('sha256').update(part.trim().toLowerCase()).digest('hex')
          : part
      )
      .join(':')
  );
}

export async function recordFailure(key: string, windowSeconds: number, store?: AttemptStore): Promise<number> {
  const s = store ?? (await defaultStore());
  const count = await s.incr(key);
  if (count === 1) {
    await s.expire(key, windowSeconds);
  } else if ((await s.ttl(key)) === -1) {
    // A previous process died (or expire failed) between incr and expire: restore the expiry so the key
    // can never block forever
    await s.expire(key, windowSeconds);
  }
  return count;
}

export async function failureCount(key: string, store?: AttemptStore): Promise<number> {
  const s = store ?? (await defaultStore());
  const raw = await s.get(key);
  const n = raw === null ? 0 : parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
}

export async function clearFailures(key: string, store?: AttemptStore): Promise<void> {
  const s = store ?? (await defaultStore());
  await s.del(key);
}

/**
 * Runs a password check with a per-user failure limit (5 wrong passwords in 15 minutes → 429).
 * Returns whether the password was right; the caller decides which error to raise. A Redis failure
 * does not block the check (it only logs a warning).
 */
export async function guardPasswordCheck(
  userId: string,
  verify: () => Promise<boolean>,
  store?: AttemptStore
): Promise<boolean> {
  const { max, windowSeconds } = ATTEMPT_LIMITS.passwordPerUser;
  const key = buildAttemptKey(['pwd', userId]);
  try {
    if (isBlocked(await failureCount(key, store), max)) {
      throw new AppError(429, 'Too many attempts, please try again later', 'TOO_MANY_ATTEMPTS');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.warn('[attempts] Password attempt limiter unavailable (Redis error): check allowed');
  }

  const ok = await verify();
  try {
    if (ok) await clearFailures(key, store);
    else await recordFailure(key, windowSeconds, store);
  } catch {
    console.warn('[attempts] Could not update the password attempt counter (Redis error)');
  }
  return ok;
}
