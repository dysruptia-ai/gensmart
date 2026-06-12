import { Worker } from 'bullmq';
interface ScrapingJobData {
    fileId: string;
    agentId: string;
    organizationId: string;
    url: string;
}
export declare function startScrapingWorker(): Worker<ScrapingJobData>;
export {};
//# sourceMappingURL=scraping.worker.d.ts.map