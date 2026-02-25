import { query } from '../config/database';
import { generateEmbedding } from './llm.service';

interface ChunkRow {
  content: string;
  metadata: {
    filename?: string;
    chunkIndex?: number;
    page?: number;
    sourceUrl?: string;
  };
}

export async function queryKnowledgeBase(
  agentId: string,
  userMessage: string,
  limit = 5
): Promise<string> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(userMessage);
    if (!embedding.length) return '';

    const vectorLiteral = `[${embedding.join(',')}]`;

    const result = await query<ChunkRow>(
      `SELECT content, metadata
       FROM knowledge_chunks
       WHERE agent_id = $1
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      [agentId, vectorLiteral, limit]
    );

    if (!result.rows.length) return '';

    const contextParts = result.rows.map((row, i) => {
      const meta = row.metadata;
      const source = meta.sourceUrl
        ? meta.sourceUrl
        : meta.filename
        ? `${meta.filename}${meta.page !== undefined ? `, page ${meta.page}` : ''}${meta.chunkIndex !== undefined ? `, chunk ${meta.chunkIndex}` : ''}`
        : `chunk ${i + 1}`;

      return `[Source: ${source}]\n${row.content}`;
    });

    return [
      'KNOWLEDGE BASE CONTEXT:',
      contextParts.join('\n\n'),
      '---',
      "Use the above context to answer the user's question when relevant.",
    ].join('\n');
  } catch (err) {
    console.error('[rag] Query failed:', err);
    return '';
  }
}

export async function hasKnowledgeBase(agentId: string): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM knowledge_files WHERE agent_id = $1 AND status = 'ready'`,
    [agentId]
  );
  return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
}

export function chunkText(
  text: string,
  maxTokens = 500,
  overlapTokens = 50
): string[] {
  // Rough token estimate: ~4 chars per token
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());

  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= maxChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        // Overlap: take last overlapChars from current chunk
        const overlap = currentChunk.slice(-overlapChars);
        currentChunk = overlap + '\n\n' + paragraph;
      } else {
        // Single paragraph exceeds maxChars — split by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) ?? [paragraph];
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxChars) {
            currentChunk += sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          }
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
}

export async function storeChunks(
  fileId: string,
  agentId: string,
  chunks: string[],
  metadata: { filename: string; sourceUrl?: string }
): Promise<void> {
  if (!chunks.length) return;

  // Delete existing chunks for this file
  await query('DELETE FROM knowledge_chunks WHERE file_id = $1', [fileId]);

  // Generate embeddings in batches of 20
  const batchSize = 20;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (content, batchIdx) => {
        const chunkIndex = i + batchIdx;
        try {
          const embedding = await generateEmbedding(content);
          const vectorLiteral = `[${embedding.join(',')}]`;
          await query(
            `INSERT INTO knowledge_chunks (file_id, agent_id, content, metadata, embedding, created_at)
             VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
            [
              fileId,
              agentId,
              content,
              JSON.stringify({
                filename: metadata.filename,
                chunkIndex,
                ...(metadata.sourceUrl ? { sourceUrl: metadata.sourceUrl } : {}),
              }),
              vectorLiteral,
            ]
          );
        } catch (err) {
          console.error(`[rag] Failed to embed chunk ${chunkIndex}:`, err);
        }
      })
    );
  }
}
