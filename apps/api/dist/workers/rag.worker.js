"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRagWorker = startRagWorker;
const bullmq_1 = require("bullmq");
const fs_1 = __importDefault(require("fs"));
const queues_1 = require("../config/queues");
const database_1 = require("../config/database");
const rag_service_1 = require("../services/rag.service");
async function extractText(filePath, fileType) {
    if (fileType === 'txt' || fileType === 'md') {
        return fs_1.default.readFileSync(filePath, 'utf-8');
    }
    if (fileType === 'pdf') {
        // pdf-parse v2: class-based API — new PDFParse({ data }) then .getText()
        const { PDFParse } = await Promise.resolve().then(() => __importStar(require('pdf-parse')));
        const dataBuffer = fs_1.default.readFileSync(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        return result.text;
    }
    if (fileType === 'docx') {
        const mammoth = await Promise.resolve().then(() => __importStar(require('mammoth')));
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }
    throw new Error(`Unsupported file type: ${fileType}`);
}
async function processRagJob(job) {
    const { fileId, agentId } = job.data;
    // Fetch knowledge file record
    const fileResult = await (0, database_1.query)('SELECT id, filename, file_type, file_path, status FROM knowledge_files WHERE id = $1', [fileId]);
    const file = fileResult.rows[0];
    if (!file) {
        console.error(`[rag-worker] File not found: ${fileId}`);
        return;
    }
    if (!file.file_path) {
        await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = 'No file path', updated_at = NOW() WHERE id = $1`, [fileId]);
        return;
    }
    try {
        console.log(`[rag-worker] Processing file: ${file.filename} (${file.file_type})`);
        // Mark as processing
        await (0, database_1.query)(`UPDATE knowledge_files SET status = 'processing', updated_at = NOW() WHERE id = $1`, [fileId]);
        // Extract text
        const text = await extractText(file.file_path, file.file_type);
        if (!text.trim()) {
            await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = 'No text content extracted', updated_at = NOW() WHERE id = $1`, [fileId]);
            return;
        }
        // Chunk text
        const chunks = (0, rag_service_1.chunkText)(text);
        console.log(`[rag-worker] Created ${chunks.length} chunks for ${file.filename}`);
        // Store chunks with embeddings
        await (0, rag_service_1.storeChunks)(fileId, agentId, chunks, { filename: file.filename });
        // Update status
        await (0, database_1.query)(`UPDATE knowledge_files SET status = 'ready', chunk_count = $1, last_processed_at = NOW(), error_message = NULL, updated_at = NOW() WHERE id = $2`, [chunks.length, fileId]);
        console.log(`[rag-worker] Done: ${file.filename} — ${chunks.length} chunks`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[rag-worker] Error processing ${file.filename}:`, err);
        await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`, [message.slice(0, 500), fileId]);
    }
}
function startRagWorker() {
    const worker = new bullmq_1.Worker('rag-processing', processRagJob, {
        connection: (0, queues_1.createBullConnection)(),
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
//# sourceMappingURL=rag.worker.js.map