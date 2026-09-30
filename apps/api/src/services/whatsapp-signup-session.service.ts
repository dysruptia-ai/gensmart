import crypto from 'crypto';
import { redis } from '../config/redis';
import { encrypt, decrypt } from '../config/encryption';
import { AppError } from '../middleware/errorHandler';

const KEY_PREFIX = 'whatsapp:signup-session:';
const TTL_SECONDS = 600;
const ID_PATTERN = /^[a-f0-9]{48}$/;

interface SignupSessionContext {
  orgId: string;
  agentId: string;
}

interface StoredSignupSession extends SignupSessionContext {
  token: string;
}

export async function createSignupSession(token: string, ctx: SignupSessionContext): Promise<string> {
  const id = crypto.randomBytes(24).toString('hex');
  const payload: StoredSignupSession = { token, orgId: ctx.orgId, agentId: ctx.agentId };
  try {
    await redis.set(KEY_PREFIX + id, encrypt(JSON.stringify(payload)), 'EX', TTL_SECONDS);
  } catch {
    throw new AppError(503, 'Could not start the connection session. Try again.', 'SIGNUP_SESSION_UNAVAILABLE');
  }
  return id;
}

export async function loadSignupSession(id: string, ctx: SignupSessionContext): Promise<string | null> {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  try {
    const raw = await redis.get(KEY_PREFIX + id);
    if (!raw) return null;
    const stored = JSON.parse(decrypt(raw)) as Partial<StoredSignupSession>;
    if (stored.orgId !== ctx.orgId || stored.agentId !== ctx.agentId) return null;
    return typeof stored.token === 'string' && stored.token.length > 0 ? stored.token : null;
  } catch {
    return null;
  }
}

export async function deleteSignupSession(id: string): Promise<void> {
  if (!ID_PATTERN.test(id)) return;
  try {
    await redis.del(KEY_PREFIX + id);
  } catch {
    // Best effort — the key expires on its own
  }
}
