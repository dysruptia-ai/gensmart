import { Worker, Job } from 'bullmq';
import fs from 'fs';
import { createBullConnection } from '../config/queues';
import { query } from '../config/database';
import { chunkText, storeChunks } from '../services/rag.service';

interface RagJobData {
  fileId: string;
  agentId: string;
  organizationId: string;
}

async function extractText(filePath: string, fileType: string): Promise<string> {
  if (fileType === 'txt' || fileType === 'md') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (fileType === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    return pdfData.text;
  }

  if (fileType === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

async function processRagJob(job: Job<RagJobData>): Promise<void> {
  const { fileId, agentId } = job.data;

  // Fetch knowledge file record
  const fileResult = await query<{
    id: string;
    filename: string;
    file_type: string;
    file_path: string | null;
    status: string;
  }>(
    'SELECT id, filename, file_type, file_path, status FROM knowledge_files WHERE id = $1',
    [fileId]
  );

  const file = fileResult.rows[0];
  if (!file) {
    console.error(`[rag-worker] File not found: ${fileId}`);
    return;
  }

  if (!file.file_path) {
    await query(
      `UPDATE knowledge_files SET status = 'error', error_message = 'No file path', updated_at = NOW() WHERE id = $1`,
      [fileId]
    );
    return;
  }

  try {
    console.log(`[rag-worker] Processing file: ${file.filename} (${file.file_type})`);

    // Mark as processing
    await query(
      `UPDATE knowledge_files SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [fileId]
    );

    // Extract text
    const text = await extractText(file.file_path, file.file_type);

    if (!text.trim()) {
      await query(
        `UPDATE knowledge_files SET status = 'error', error_message = 'No text content extracted', updated_at = NOW() WHERE id = $1`,
        [fileId]
      );
      return;
    }

    // Chunk text
    const chunks = chunkText(text);
    console.log(`[rag-worker] Created ${chunks.length} chunks for ${file.filename}`);

    // Store chunks with embeddings
    await storeChunks(fileId, agentId, chunks, { filename: file.filename });

    // Update status
    await query(
      `UPDATE knowledge_files SET status = 'ready', chunk_count = $1, last_processed_at = NOW(), error_message = NULL, updated_at = NOW() WHERE id = $2`,
      [chunks.length, fileId]
    );

    console.log(`[rag-worker] Done: ${file.filename} — ${chunks.length} chunks`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[rag-worker] Error processing ${file.filename}:`, err);
    await query(
      `UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [message.slice(0, 500), fileId]
    );
  }
}

export function startRagWorker(): Worker<RagJobData> {
  const worker = new Worker<RagJobData>('rag-processing', processRagJob, {
    connection: createBullConnection(),
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    console.log(`[rag-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[rag-worker] Job ${job?.id} failed:`, err);
  });

  return worker;
}
