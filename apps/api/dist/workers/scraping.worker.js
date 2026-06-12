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
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScrapingWorker = startScrapingWorker;
const bullmq_1 = require("bullmq");
const queues_1 = require("../config/queues");
const database_1 = require("../config/database");
const rag_service_1 = require("../services/rag.service");
async function scrapeUrl(url) {
    const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'GenSmart-Bot/1.0 (knowledge base crawler)',
            Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
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
async function processScrapingJob(job) {
    const { fileId, agentId, url } = job.data;
    const fileResult = await (0, database_1.query)('SELECT id, filename FROM knowledge_files WHERE id = $1', [fileId]);
    const file = fileResult.rows[0];
    if (!file) {
        console.error(`[scraping-worker] File not found: ${fileId}`);
        return;
    }
    try {
        console.log(`[scraping-worker] Scraping: ${url}`);
        await (0, database_1.query)(`UPDATE knowledge_files SET status = 'processing', updated_at = NOW() WHERE id = $1`, [fileId]);
        const text = await scrapeUrl(url);
        if (!text.trim()) {
            await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = 'No text content scraped from URL', updated_at = NOW() WHERE id = $1`, [fileId]);
            return;
        }
        const chunks = (0, rag_service_1.chunkText)(text);
        console.log(`[scraping-worker] Created ${chunks.length} chunks for ${url}`);
        await (0, rag_service_1.storeChunks)(fileId, agentId, chunks, {
            filename: file.filename,
            sourceUrl: url,
        });
        await (0, database_1.query)(`UPDATE knowledge_files SET status = 'ready', chunk_count = $1, last_processed_at = NOW(), error_message = NULL, updated_at = NOW() WHERE id = $2`, [chunks.length, fileId]);
        console.log(`[scraping-worker] Done: ${url} — ${chunks.length} chunks`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scraping-worker] Error scraping ${url}:`, err);
        await (0, database_1.query)(`UPDATE knowledge_files SET status = 'error', error_message = $1, updated_at = NOW() WHERE id = $2`, [message.slice(0, 500), fileId]);
    }
}
function startScrapingWorker() {
    const worker = new bullmq_1.Worker('scraping-processing', processScrapingJob, {
        connection: (0, queues_1.createBullConnection)(),
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
//# sourceMappingURL=scraping.worker.js.map