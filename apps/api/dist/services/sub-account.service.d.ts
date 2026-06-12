interface SubAccountData {
    id: string;
    childOrgId: string;
    label: string;
    name: string;
    plan: string;
    created_at: string;
}
export declare function getSubAccounts(parentOrgId: string): Promise<SubAccountData[]>;
export declare function createSubAccount(parentOrgId: string, data: {
    name: string;
    label: string;
}): Promise<SubAccountData>;
export declare function removeSubAccount(parentOrgId: string, childOrgId: string): Promise<void>;
export declare function switchToSubAccount(userId: string, userEmail: string, userRole: string, parentOrgId: string, childOrgId: string): Promise<{
    accessToken: string;
}>;
export {};
//# sourceMappingURL=sub-account.service.d.ts.map