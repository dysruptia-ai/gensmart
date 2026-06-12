"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryKnowledgeBase = queryKnowledgeBase;
exports.hasKnowledgeBase = hasKnowledgeBase;
exports.chunkText = chunkText;
exports.storeChunks = storeChunks;
const database_1 = require("../config/database");
const llm_service_1 = require("./llm.service");
async function queryKnowledgeBase(agentId, userMessage, limit = 5) {
    try {
        console.log('[rag] queryKnowledgeBase called for agent:', agentId);
        const embedding = await (0, llm_service_1.generateEmbedding)(userMessage);
        console.log('[rag] embedding length:', embedding.length);
        if (!embedding.length) {
            console.warn('[rag] Empty embedding returned — check OPENAI_API_KEY and model availability');
            return '';
        }
        const vectorLiteral = `[${embedding.join(',')}]`;
        const result = await (0, database_1.query)(`SELECT content, metadata
       FROM knowledge_chunks
       WHERE agent_id = $1
       ORDER BY embedding <=> $2::vector
       LIMIT $3`, [agentId, vectorLiteral, limit]);
        console.log('[rag] chunks found:', result.rows.length);
        if (!result.rows.length)
            return '';
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
            'IMPORTANT: Always prioritize the KNOWLEDGE BASE CONTEXT above to answer user questions.',
            'If the answer exists in the context, use it directly. Only fall back to your general knowledge if the context does not contain relevant information.',
        ].join('\n');
    }
    catch (err) {
        console.error('[rag] Query failed:', err);
        return '';
    }
}
async function hasKnowledgeBase(agentId) {
    const result = await (0, database_1.query)(`SELECT COUNT(*) as count FROM knowledge_files WHERE agent_id = $1 AND status = 'ready'`, [agentId]);
    return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
}
function chunkText(text, maxTokens = 500, overlapTokens = 50) {
    // Rough token estimate: ~4 chars per token
    const maxChars = maxTokens * 4;
    const overlapChars = overlapTokens * 4;
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
    let currentChunk = '';
    for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length <= maxChars) {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
        else {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                // Overlap: take last overlapChars from current chunk
                const overlap = currentChunk.slice(-overlapChars);
                currentChunk = overlap + '\n\n' + paragraph;
            }
            else {
                // Single paragraph exceeds maxChars — split by sentences
                const sentences = paragraph.match(/[^.!?]+[.!?]+/g) ?? [paragraph];
                for (const sentence of sentences) {
                    if ((currentChunk + sentence).length <= maxChars) {
                        currentChunk += sentence;
                    }
                    else {
                        if (currentChunk)
                            chunks.push(currentChunk.trim());
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
async function storeChunks(fileId, agentId, chunks, metadata) {
    if (!chunks.length)
        return;
    // Delete existing chunks for this file
    await (0, database_1.query)('DELETE FROM knowledge_chunks WHERE file_id = $1', [fileId]);
    // Generate embeddings in batches of 20
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await Promise.all(batch.map(async (content, batchIdx) => {
            const chunkIndex = i + batchIdx;
            try {
                const embedding = await (0, llm_service_1.generateEmbedding)(content);
                const vectorLiteral = `[${embedding.join(',')}]`;
                await (0, database_1.query)(`INSERT INTO knowledge_chunks (file_id, agent_id, content, metadata, embedding, created_at)
             VALUES ($1, $2, $3, $4, $5::vector, NOW())`, [
                    fileId,
                    agentId,
                    content,
                    JSON.stringify({
                        filename: metadata.filename,
                        chunkIndex,
                        ...(metadata.sourceUrl ? { sourceUrl: metadata.sourceUrl } : {}),
                    }),
                    vectorLiteral,
                ]);
            }
            catch (err) {
                console.error(`[rag] Failed to embed chunk ${chunkIndex}:`, err);
            }
        }));
    }
}
//# sourceMappingURL=rag.service.js.map