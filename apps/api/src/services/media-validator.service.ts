import crypto from 'crypto';
import { redis } from '../config/redis';
import { assertSafeUrl, safeFetch, UnsafeUrlError } from './safe-url';

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

export interface MediaValidationResult {
  valid: boolean;
  mimeType?: string;
  sizeBytes?: number;
  error?: string;
  errorCode?: 'INVALID_URL' | 'SSRF_BLOCKED' | 'NOT_HTTPS' | 'HEAD_FAILED' | 'WRONG_TYPE' | 'TOO_LARGE' | 'TIMEOUT';
  // WebP images pass validation but must be transcoded to JPEG (via the media
  // proxy) before being sent — WhatsApp Cloud API only accepts JPEG/PNG.
  needsConversion?: boolean;
  effectiveMimeType?: string;
}

export type MediaType = 'image' | 'video' | 'document' | 'audio';

// MIME types that some object stores (e.g. S3) return when the upload had no
// explicit Content-Type set. We can't trust these — fall back to magic bytes.
const UNTRUSTED_MIME_TYPES = new Set<string>([
  'application/octet-stream',
  'binary/octet-stream',
  'application/binary',
  '',
]);

/**
 * Inspect the leading bytes of a buffer and return the detected image MIME type.
 * PNG, JPEG (WhatsApp-native) and WebP (transcoded via the media proxy, see
 * `needsConversion` in MediaValidationResult) are recognized.
 */
export function detectImageMimeFromBytes(bytes: Buffer): string | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}

/** Maps a failed request to a result without revealing why a destination was refused. */
function mediaFetchFailure(err: unknown, timeoutMessage: string, failureMessage: string): MediaValidationResult {
  if (err instanceof UnsafeUrlError && err.code !== 'RESPONSE_TOO_LARGE') {
    return { valid: false, error: 'URL is not allowed', errorCode: 'SSRF_BLOCKED' };
  }
  if ((err as { code?: string }).code === 'EUNSAFE_ADDRESS') {
    return { valid: false, error: 'URL is not allowed', errorCode: 'SSRF_BLOCKED' };
  }
  const isTimeout = (err as Error).name === 'AbortError';
  return {
    valid: false,
    error: isTimeout ? timeoutMessage : failureMessage,
    errorCode: isTimeout ? 'TIMEOUT' : 'HEAD_FAILED',
  };
}

export async function validateMediaUrl(
  url: string,
  type: MediaType
): Promise<MediaValidationResult> {
  // 1-3. Scheme, credentials and destination (DNS is resolved and every address must be public)
  try {
    await assertSafeUrl(url);
  } catch (err) {
    const code = err instanceof UnsafeUrlError ? err.code : 'INVALID_URL';
    if (code === 'INVALID_URL') {
      return { valid: false, error: 'Invalid URL format', errorCode: 'INVALID_URL' };
    }
    if (code === 'NOT_HTTPS' || code === 'CREDENTIALS_IN_URL') {
      return { valid: false, error: 'URL must use HTTPS', errorCode: 'NOT_HTTPS' };
    }
    return { valid: false, error: 'URL is not allowed', errorCode: 'SSRF_BLOCKED' };
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

  let contentType: string | null = null;
  let contentLength: number | null = null;

  try {
    // Redirects are followed manually and every hop is validated again (see safeFetch)
    const headRes = await safeFetch(url, {
      method: 'HEAD',
      timeoutMs: MEDIA_VALIDATION_HEAD_TIMEOUT_MS,
    });

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
    return mediaFetchFailure(err, 'URL validation timed out', 'Could not reach URL');
  }

  // 6. Validate Content-Type
  // Compare base mime type, ignoring parameters (e.g. "image/jpeg; charset=binary" → "image/jpeg")
  const baseMimeType = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
  const allowedTypes = (limits.allowedMimeTypes as readonly string[]);

  // For images, if the server returned an untrusted/generic Content-Type (common with
  // S3 / CloudFront uploads where the content-type wasn't set explicitly), fall back
  // to inspecting the first bytes of the file to detect the real MIME type.
  let effectiveMimeType: string = baseMimeType;
  if (type === 'image' && UNTRUSTED_MIME_TYPES.has(baseMimeType)) {
    let detected: string | null = null;
    try {
      // Only the first bytes are needed; a server that ignores Range is cut after 12 bytes
      const rangeRes = await safeFetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-11' },
        timeoutMs: MEDIA_VALIDATION_HEAD_TIMEOUT_MS,
        maxBytes: 12,
        truncate: true,
      });
      if (!rangeRes.ok && rangeRes.status !== 206) {
        return {
          valid: false,
          error: `Could not fetch media bytes (HTTP ${rangeRes.status})`,
          errorCode: 'HEAD_FAILED',
        };
      }
      const buf = Buffer.from(await rangeRes.arrayBuffer());
      detected = detectImageMimeFromBytes(buf);
    } catch (err) {
      return mediaFetchFailure(err, 'Media byte check timed out', 'Could not fetch media bytes');
    }

    if (!detected || (!allowedTypes.includes(detected) && detected !== 'image/webp')) {
      return {
        valid: false,
        error: `URL does not point to a valid image (Content-Type "${baseMimeType || 'missing'}", magic bytes did not match PNG, JPEG or WebP)`,
        errorCode: 'WRONG_TYPE',
      };
    }
    effectiveMimeType = detected;
  } else {
    if (!contentType) {
      return { valid: false, error: 'URL did not return a Content-Type header', errorCode: 'WRONG_TYPE' };
    }
    if (!allowedTypes.includes(baseMimeType) && !(type === 'image' && baseMimeType === 'image/webp')) {
      return {
        valid: false,
        error: `Content-Type "${baseMimeType}" is not allowed for ${type}. Allowed: ${allowedTypes.join(', ')}`,
        errorCode: 'WRONG_TYPE',
      };
    }
    effectiveMimeType = baseMimeType;
  }

  // WebP images are valid but must be transcoded to JPEG (via the media proxy)
  // before being sent to WhatsApp or the widget — neither accepts WebP directly.
  const needsConversion = type === 'image' && effectiveMimeType === 'image/webp';
  if (needsConversion) {
    effectiveMimeType = 'image/jpeg';
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
    mimeType: effectiveMimeType,
    sizeBytes: contentLength ?? undefined,
    ...(needsConversion ? { needsConversion: true, effectiveMimeType } : {}),
  };

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', MEDIA_VALIDATION_CACHE_TTL);
  } catch {
    // Redis unavailable — continue without caching
  }

  return result;
}
