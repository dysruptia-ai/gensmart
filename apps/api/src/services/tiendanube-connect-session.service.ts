import crypto from 'crypto';
import { redis } from '../config/redis';
import { encrypt, decrypt } from '../config/encryption';
import { AppError } from '../middleware/errorHandler';

const KEY_PREFIX = 'tiendanube:connect-session:';
const TTL_SECONDS = 600;
const ID_PATTERN = /^[a-f0-9]{48}$/;

export interface ConnectSessionPayload {
  organizationId: string;
  agentId: string;
}

export async function createConnectSession(ctx: ConnectSessionPayload): Promise<string> {
  const id = crypto.randomBytes(24).toString('hex');
  try {
    await redis.set(KEY_PREFIX + id, encrypt(JSON.stringify(ctx)), 'EX', TTL_SECONDS);
  } catch {
    throw new AppError(503, 'Could not start the connection session. Try again.', 'CONNECT_SESSION_UNAVAILABLE');
  }
  return id;
}

/** Single-use: atomically reads and deletes the session. Returns null if missing/expired/corrupt. */
export async function consumeConnectSession(id: string): Promise<ConnectSessionPayload | null> {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  try {
    const raw = await redis.getdel(KEY_PREFIX + id);
    if (!raw) return null;
    const stored = JSON.parse(decrypt(raw)) as Partial<ConnectSessionPayload>;
    if (!stored.organizationId || !stored.agentId) return null;
    return { organizationId: stored.organizationId, agentId: stored.agentId };
  } catch {
    return null;
  }
}
