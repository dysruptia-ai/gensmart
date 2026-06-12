import { Worker } from 'bullmq';
interface RagJobData {
    fileId: string;
    agentId: string;
    organizationId: string;
}
export declare function startRagWorker(): Worker<RagJobData>;
export {};
//# sourceMappingURL=rag.worker.d.ts.map