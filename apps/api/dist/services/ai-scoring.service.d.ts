export interface ScoringResult {
    summary: string;
    score: number;
    service: string;
    variables: Record<string, string>;
}
export declare function scoreConversation(conversationId: string, orgId: string): Promise<ScoringResult>;
//# sourceMappingURL=ai-scoring.service.d.ts.map