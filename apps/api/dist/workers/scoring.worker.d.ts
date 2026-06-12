import { Worker } from 'bullmq';
interface ScoringJobData {
    conversationId: string;
    organizationId: string;
    trigger: 'conversation_close' | 'message_threshold' | 'manual';
}
export declare function startScoringWorker(): Worker<ScoringJobData>;
export {};
//# sourceMappingURL=scoring.worker.d.ts.map