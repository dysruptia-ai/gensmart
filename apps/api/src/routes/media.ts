import { Router, Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import {
  detectImageMimeFromBytes,
  MEDIA_LIMITS,
} from '../services/media-validator.service';
import { assertSafeUrl, safeFetch, UnsafeUrlError } from '../services/safe-url';

const router = Router();

const PROXY_FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = MEDIA_LIMITS.image.maxSizeBytes;

/**
 * Public proxy that re-serves remote images with a correct Content-Type.
 *
 * Why this exists: Meta's WhatsApp Cloud API rejects image URLs whose
 * Content-Type isn't image/jpeg or image/png. Some CDNs (e.g. S3 + CloudFront)
 * serve valid images as application/octet-stream when the upload had no
 * explicit content type. This endpoint downloads such files, detects the real
 * MIME type from magic bytes, and re-serves them with the correct header.
 *
 * No auth — Meta must be able to fetch it. SSRF-protected by the shared safe-url module
 * (DNS resolved and every address must be public, redirects revalidated); only HTTPS upstreams.
 */
// Helmet's global Cross-Origin-Resource-Policy: same-origin would block <img>
// loads from the embedded storefront widget; relax it for this route only.
router.use('/proxy', (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

router.get('/proxy', async (req: Request, res: Response) => {
  const raw = req.query['url'];
  if (typeof raw !== 'string' || !raw) {
    res.status(400).json({ error: 'Missing required query parameter: url' });
    return;
  }

  let parsed: URL;
  try {
    parsed = await assertSafeUrl(raw);
  } catch (err) {
    const code = err instanceof UnsafeUrlError ? err.code : 'INVALID_URL';
    if (code === 'INVALID_URL') {
      res.status(400).json({ error: 'Invalid URL' });
    } else if (code === 'NOT_HTTPS' || code === 'CREDENTIALS_IN_URL') {
      res.status(400).json({ error: 'URL must use HTTPS' });
    } else {
      res.status(403).json({ error: 'URL is not allowed' });
    }
    return;
  }

  try {
    // Redirects are followed manually; every hop is validated again and the size is capped while reading
    const upstream = await safeFetch(parsed.toString(), {
      method: 'GET',
      timeoutMs: PROXY_FETCH_TIMEOUT_MS,
      maxBytes: MAX_IMAGE_BYTES,
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream returned HTTP ${upstream.status}` });
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: 'Image exceeds maximum size (5MB)' });
      return;
    }

    const detected = detectImageMimeFromBytes(buf);
    if (!detected) {
      res.status(415).json({ error: 'Content is not a valid PNG, JPEG or WebP image' });
      return;
    }

    // WebP isn't accepted by WhatsApp/the widget — transcode to JPEG on the fly.
    // Animated WebP (or anything sharp can't decode) falls through to the same
    // 415 as any other unsupported format.
    if (detected === 'image/webp') {
      try {
        const jpegBuffer = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', jpegBuffer.length.toString());
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).end(jpegBuffer);
        return;
      } catch {
        res.status(415).json({ error: 'Content is not a valid PNG, JPEG or WebP image' });
        return;
      }
    }

    res.setHeader('Content-Type', detected);
    res.setHeader('Content-Length', buf.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).end(buf);
  } catch (err) {
    if (err instanceof UnsafeUrlError && err.code === 'RESPONSE_TOO_LARGE') {
      res.status(413).json({ error: 'Image exceeds maximum size (5MB)' });
      return;
    }
    if ((err instanceof UnsafeUrlError) || (err as { code?: string }).code === 'EUNSAFE_ADDRESS') {
      res.status(403).json({ error: 'URL is not allowed' });
      return;
    }
    if ((err as Error).name === 'AbortError') {
      res.status(504).json({ error: 'Upstream fetch timed out' });
      return;
    }
    res.status(502).json({ error: 'Could not fetch upstream' });
  }
});

export default router;
