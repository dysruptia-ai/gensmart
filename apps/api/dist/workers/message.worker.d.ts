import { Worker } from 'bullmq';
interface MessageJobData {
    conversationId: string;
    agentId: string;
    organizationId: string;
}
export declare function startMessageWorker(): Worker<MessageJobData>;
export {};
//# sourceMappingURL=message.worker.d.ts.map