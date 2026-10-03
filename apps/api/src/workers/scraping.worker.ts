import { Worker, Job } from 'bullmq';
import { createBullConnection } from '../config/queues';
import { query } from '../config/database';
import { chunkText, storeChunks } from '../services/rag.service';
import { safeFetch, UnsafeUrlError } from '../services/safe-url';

interface ScrapingJobData {
  fileId: string;
  agentId: string;
  organizationId: string;
  url: string;
}

const SCRAPE_MAX_BYTES = 5 * 1024 * 1024;
const SCRAPE_ALLOWED_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml', 'text/plain']);

/** Message stored on the file: it never reveals why a URL was rejected. */
function describeScrapeError(err: unknown): string {
  if (err instanceof UnsafeUrlError) {
    return err.code === 'RESPONSE_TOO_LARGE' ? 'The page exceeds the maximum size (5MB)' : 'URL not allowed';
  }
  if ((err as { code?: string }).code === 'EUNSAFE_ADDRESS') return 'URL not allowed';
  return err instanceof Error ? err.message : String(err);
}

async function scrapeUrl(url: string): Promise<string> {
  const cheerio = await import('cheerio');

  const response = await safeFetch(url, {
    headers: {
      'User-Agent': 'GenSmart-Bot/1.0 (knowledge base crawler)',
      Accept: 'text/html,application/xhtml+xml',
    },
    timeoutMs: 30000,
    maxBytes: SCRAPE_MAX_BYTES,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching the URL`);
  }

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!SCRAPE_ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error('The URL does not return an HTML or plain text page');
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove noisy elements
  $('script, style, nav, footer, header, iframe, noscript, .ads, #ads, .sidebar, .navigation, .menu').remove();

  // Extract main content areas, fallback to body
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '#post', 'body'];
  let text = '';
  for (const sel of mainSelectors) {
    const el = $(sel).first();
    if (el.length) {
      text = el.text();
      break;
    }
  }

  // Clean up whitespace
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function processScrapingJob(job: Job<ScrapingJobData>): Promise<void> {
  const { fileId, agentId, organizationId, url } = job.data;

  const fileResult = await query<{
    id: string;
    filename: string;
  }>(
    `SELECT kf.id, kf.filename
     FROM knowledge_files kf
     JOIN agents a ON a.id = kf.agent_id
     WHERE kf.id = $1 AND kf.agent_id = $2 AND a.organization_id = $3`,
    [fileId, agentId, organizationId]
  );

  const file = fileResult.rows[0];
  if (!file) {
    console.error(
      `[scraping-worker] File not found or ids do not match, skipping: file=${fileId} job agent=${agentId} job org=${organizationId}`
    );
    return;
  }

  try {
    console.log(`[scraping-worker] Scraping file ${fileId}`);

    await query(
      `UPDATE knowledge_files SET status = 'processing', updated_at = NOW() WHERE id = $1 AND agent_id = $2`,
      [fileId, agentId]
    );

    const text = await scrapeUrl(url);

    if (!text.trim()) {
      await query(
        `UPDATE knowledge_files SET status = 'error', error_message = 'No text content scraped from URL', updated_at = NOW() WHERE id = $1 AND agent_id = $2`,
        [fileId, agentId]
      );
      return;
    }

    const chunks = chunkText(text);
    console.log(`[scraping-worker] Created ${chunks.length} chunks for file ${fileId}`);

    await storeChunks(fileId, agentId, chunks, {
      filename: file.filename,
      sourceUrl: url,
    });

    await query(
      `UPDATE knowledge_files SET status = 'ready', chunk_count = $1, last_processed_at = NOW(), error_message = NULL, updated_at = NOW() WHERE id = $2 AND agent_id = $3`,
      [chunks.length, fileId, agentId]
    );

    console.log(`[scraping-worker] Done: file ${fileId} — ${chunks.length} chunks`);
  } catch (err) {
    const message = describeScrapeError(err);
    console.error(`[scraping-worker] Error scraping file ${fileId}: ${message}`);
    await query(
      `UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2 AND agent_id = $3`,
      [message.slice(0, 500), fileId, agentId]
    );
  }
}

export function startScrapingWorker(): Worker<ScrapingJobData> {
  const worker = new Worker<ScrapingJobData>('scraping-processing', processScrapingJob, {
    connection: createBullConnection(),
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    console.log(`[scraping-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[scraping-worker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
