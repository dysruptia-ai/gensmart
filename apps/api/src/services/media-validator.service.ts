import crypto from 'crypto';
import { redis } from '../config/redis';

// Meta WhatsApp Cloud API limits (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)
export const MEDIA_LIMITS = {
  image: {
    maxSizeBytes: 5 * 1024 * 1024,        // 5 MB
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  },
  video: {
    maxSizeBytes: 16 * 1024 * 1024,       // 16 MB
    allowedMimeTypes: ['video/mp4', 'video/3gpp'],
  },
  document: {
    maxSizeBytes: 100 * 1024 * 1024,      // 100 MB
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
  },
  audio: {
    maxSizeBytes: 16 * 1024 * 1024,       // 16 MB
    allowedMimeTypes: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'],
  },
} as const;

export const MEDIA_VALIDATION_CACHE_TTL = 3600; // 1 hour
export const MEDIA_VALIDATION_HEAD_TIMEOUT_MS = 8000;

// SSRF blocklist — private IP ranges, metadata endpoints, localhost
// TODO: For stronger SSRF protection, also resolve hostname via dns.promises.lookup()
// and check the resulting IP against these patterns (prevents DNS-rebinding attacks).
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,                            // AWS/GCP metadata endpoint
  /^::1$/,                                  // IPv6 localhost
  /^fc00:/i,                                // IPv6 private
  /^fe80:/i,                                // IPv6 link-local
  /\.local$/i,
  /\.internal$/i,
];

export interface MediaValidationResult {
  valid: boolean;
  mimeType?: string;
  sizeBytes?: number;
  error?: string;
  errorCode?: 'INVALID_URL' | 'SSRF_BLOCKED' | 'NOT_HTTPS' | 'HEAD_FAILED' | 'WRONG_TYPE' | 'TOO_LARGE' | 'TIMEOUT';
}

export type MediaType = 'image' | 'video' | 'document' | 'audio';

function isHostBlocked(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

export async function validateMediaUrl(
  url: string,
  type: MediaType
): Promise<MediaValidationResult> {
  // 1. Parse the URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format', errorCode: 'INVALID_URL' };
  }

  // 2. Validate protocol
  const isDev = process.env['NODE_ENV'] === 'development';
  if (parsed.protocol !== 'https:' && !(isDev && parsed.protocol === 'http:')) {
    return { valid: false, error: 'URL must use HTTPS', errorCode: 'NOT_HTTPS' };
  }

  // 3. SSRF protection — check hostname against blocklist
  if (isHostBlocked(parsed.hostname)) {
    return { valid: false, error: 'URL points to a blocked host (private network or localhost)', errorCode: 'SSRF_BLOCKED' };
  }

  // 4. Check Redis cache
  const urlHash = crypto.createHash('sha256').update(url).digest('hex');
  const cacheKey = `media:validated:${urlHash}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const result = JSON.parse(cached) as MediaValidationResult;
      if (result.valid) {
        return result;
      }
    }
  } catch {
    // Redis unavailable — proceed without cache
  }

  // 5. HEAD request with timeout
  const limits = MEDIA_LIMITS[type];
  if (!limits) {
    return { valid: false, error: `Unsupported media type: ${type}`, errorCode: 'WRONG_TYPE' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MEDIA_VALIDATION_HEAD_TIMEOUT_MS);

  let contentType: string | null = null;
  let contentLength: number | null = null;

  try {
    const headRes = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',    // Follow redirects but still validate host (browser behavior)
    });

    clearTimeout(timeoutId);

    if (!headRes.ok) {
      return {
        valid: false,
        error: `URL returned HTTP ${headRes.status}`,
        errorCode: 'HEAD_FAILED',
      };
    }

    contentType = headRes.headers.get('content-type');
    const lengthHeader = headRes.headers.get('content-length');
    contentLength = lengthHeader ? parseInt(lengthHeader, 10) : null;
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = (err as Error).name === 'AbortError';
    return {
      valid: false,
      error: isTimeout ? 'URL validation timed out' : `Could not reach URL: ${(err as Error).message}`,
      errorCode: isTimeout ? 'TIMEOUT' : 'HEAD_FAILED',
    };
  }

  // 6. Validate Content-Type
  if (!contentType) {
    return { valid: false, error: 'URL did not return a Content-Type header', errorCode: 'WRONG_TYPE' };
  }

  // Compare base mime type, ignoring parameters (e.g. "image/jpeg; charset=binary" → "image/jpeg")
  const baseMimeType = contentType.split(';')[0]!.trim().toLowerCase();
  const allowedTypes = (limits.allowedMimeTypes as readonly string[]);
  if (!allowedTypes.includes(baseMimeType)) {
    return {
      valid: false,
      error: `Content-Type "${baseMimeType}" is not allowed for ${type}. Allowed: ${allowedTypes.join(', ')}`,
      errorCode: 'WRONG_TYPE',
    };
  }

  // 7. Validate Content-Length (only if server provided it)
  if (contentLength !== null && !isNaN(contentLength)) {
    if (contentLength > limits.maxSizeBytes) {
      const maxMB = (limits.maxSizeBytes / 1024 / 1024).toFixed(0);
      const sizeMB = (contentLength / 1024 / 1024).toFixed(1);
      return {
        valid: false,
        error: `File too large (${sizeMB}MB). Maximum for ${type} is ${maxMB}MB`,
        errorCode: 'TOO_LARGE',
      };
    }
  }

  // 8. All checks passed — cache and return
  const result: MediaValidationResult = {
    valid: true,
    mimeType: baseMimeType,
    sizeBytes: contentLength ?? undefined,
  };

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', MEDIA_VALIDATION_CACHE_TTL);
  } catch {
    // Redis unavailable — continue without caching
  }

  return result;
}
