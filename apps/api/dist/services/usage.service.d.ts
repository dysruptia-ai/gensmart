export declare function incrementMessages(orgId: string): Promise<number>;
export declare function getMessageCount(orgId: string): Promise<number>;
export declare function checkLimit(orgId: string, plan: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
}>;
//# sourceMappingURL=usage.service.d.ts.map