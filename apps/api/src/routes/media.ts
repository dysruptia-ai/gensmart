import { Router, Request, Response } from 'express';
import {
  detectImageMimeFromBytes,
  isHostBlocked,
  MEDIA_LIMITS,
} from '../services/media-validator.service';

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
 * No auth — Meta must be able to fetch it. SSRF-protected via the shared
 * blocklist; only HTTPS upstreams allowed.
 */
router.get('/proxy', async (req: Request, res: Response) => {
  const raw = req.query['url'];
  if (typeof raw !== 'string' || !raw) {
    res.status(400).json({ error: 'Missing required query parameter: url' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  if (parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'URL must use HTTPS' });
    return;
  }

  if (isHostBlocked(parsed.hostname)) {
    res.status(403).json({ error: 'URL points to a blocked host' });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream returned HTTP ${upstream.status}` });
      return;
    }

    const lengthHeader = upstream.headers.get('content-length');
    const declaredLength = lengthHeader ? parseInt(lengthHeader, 10) : NaN;
    if (!isNaN(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: 'Image exceeds maximum size (5MB)' });
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: 'Image exceeds maximum size (5MB)' });
      return;
    }

    const detected = detectImageMimeFromBytes(buf);
    if (!detected) {
      res.status(415).json({ error: 'Content is not a valid PNG or JPEG image' });
      return;
    }

    res.setHeader('Content-Type', detected);
    res.setHeader('Content-Length', buf.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).end(buf);
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = (err as Error).name === 'AbortError';
    if (isTimeout) {
      res.status(504).json({ error: 'Upstream fetch timed out' });
      return;
    }
    res.status(502).json({ error: `Could not fetch upstream: ${(err as Error).message}` });
  }
});

export default router;
