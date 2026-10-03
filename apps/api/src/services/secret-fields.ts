import { encrypt, decrypt } from '../config/encryption';

/**
 * Encryption at rest for the credentials of custom_function tools (agent_tools.config):
 * auth.token, auth.apiKey and the values of sensitive headers (Authorization, X-API-Key, ...).
 *
 * Stored form: "enc:v1:" + encrypt(value). Configurations not migrated yet keep working: plaintext
 * values pass through reveal. The API never returns the real values: it returns SECRET_MASK.
 */

export const SECRET_PREFIX = 'enc:v1:';
export const SECRET_MASK = '••••••••';

const SENSITIVE_HEADER = /^(authorization|proxy-authorization|cookie)$|key|token|secret|password|auth/i;

export interface SecretCodec {
  encrypt(text: string): string;
  decrypt(text: string): string;
}

const defaultCodec: SecretCodec = { encrypt, decrypt };

type Config = Record<string, unknown>;

const AUTH_SECRET_FIELDS = ['token', 'apiKey'] as const;

export function isSensitiveHeaderName(name: string): boolean {
  return SENSITIVE_HEADER.test(name);
}

export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(SECRET_PREFIX);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Applies fn to every secret slot of the config; returns a new config (the input is not modified). */
function mapSecrets(
  config: Config,
  fn: (value: string, slot: { kind: 'auth'; field: string } | { kind: 'header'; name: string }) => string | undefined
): Config {
  const out: Config = { ...config };

  if (isPlainObject(config['auth'])) {
    const auth: Record<string, unknown> = { ...config['auth'] };
    for (const field of AUTH_SECRET_FIELDS) {
      const value = auth[field];
      if (typeof value !== 'string') continue;
      const next = fn(value, { kind: 'auth', field });
      if (next === undefined) delete auth[field];
      else auth[field] = next;
    }
    out['auth'] = auth;
  }

  if (isPlainObject(config['headers'])) {
    const headers: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(config['headers'])) {
      if (typeof value !== 'string' || !isSensitiveHeaderName(name)) {
        headers[name] = value;
        continue;
      }
      const next = fn(value, { kind: 'header', name });
      if (next !== undefined) headers[name] = next;
    }
    out['headers'] = headers;
  }

  return out;
}

function storedValueFor(
  existing: Config | undefined,
  slot: { kind: 'auth'; field: string } | { kind: 'header'; name: string }
): string | undefined {
  if (!existing) return undefined;
  if (slot.kind === 'auth') {
    const auth = existing['auth'];
    const value = isPlainObject(auth) ? auth[slot.field] : undefined;
    return typeof value === 'string' ? value : undefined;
  }
  const headers = existing['headers'];
  if (!isPlainObject(headers)) return undefined;
  const lower = slot.name.toLowerCase();
  const key = Object.keys(headers).find((k) => k === slot.name) ?? Object.keys(headers).find((k) => k.toLowerCase() === lower);
  const value = key !== undefined ? headers[key] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Config as it must be stored. Plaintext values are encrypted; a value equal to SECRET_MASK means
 * "unchanged" and keeps the stored value of that same field (dropped when there is none). A client
 * value that merely looks like ciphertext is treated as plaintext: it is never trusted as stored form.
 */
export function protectCustomFunctionConfig(
  incoming: Config,
  existing?: Config,
  codec: SecretCodec = defaultCodec
): Config {
  return mapSecrets(incoming, (value, slot) => {
    if (value === '') return value;
    if (value === SECRET_MASK) {
      const stored = storedValueFor(existing, slot);
      if (stored === undefined || stored === '' || stored === SECRET_MASK) return undefined;
      return isEncryptedSecret(stored) ? stored : SECRET_PREFIX + codec.encrypt(stored);
    }
    return SECRET_PREFIX + codec.encrypt(value);
  });
}

/** Encrypts only the values still in plaintext (migration). Reports whether anything changed. */
export function encryptPlainSecrets(
  config: Config,
  codec: SecretCodec = defaultCodec
): { config: Config; changed: boolean } {
  let changed = false;
  const next = mapSecrets(config, (value) => {
    if (value === '' || value === SECRET_MASK || isEncryptedSecret(value)) return value;
    changed = true;
    return SECRET_PREFIX + codec.encrypt(value);
  });
  return { config: next, changed };
}

/** Config ready to execute. Plaintext values (not migrated yet) pass through unchanged. */
export function revealCustomFunctionConfig(config: Config, codec: SecretCodec = defaultCodec): Config {
  return mapSecrets(config, (value) => {
    if (!isEncryptedSecret(value)) return value;
    try {
      return codec.decrypt(value.slice(SECRET_PREFIX.length));
    } catch {
      // Never include the stored text or the crypto error in the message
      throw new Error('Could not read the stored credentials of the tool');
    }
  });
}

/** Config for API responses: every non-empty sensitive value, encrypted or not, becomes SECRET_MASK. */
export function maskCustomFunctionConfig(config: Config): Config {
  return mapSecrets(config, (value) => (value === '' ? value : SECRET_MASK));
}
