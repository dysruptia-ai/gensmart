export declare function queryKnowledgeBase(agentId: string, userMessage: string, limit?: number): Promise<string>;
export declare function hasKnowledgeBase(agentId: string): Promise<boolean>;
export declare function chunkText(text: string, maxTokens?: number, overlapTokens?: number): string[];
export declare function storeChunks(fileId: string, agentId: string, chunks: string[], metadata: {
    filename: string;
    sourceUrl?: string;
}): Promise<void>;
//# sourceMappingURL=rag.service.d.ts.map