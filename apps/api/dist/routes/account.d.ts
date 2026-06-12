declare const router: import("express-serve-static-core").Router;
/**
 * Performs the full account deletion in a transaction.
 * Order matters — foreign key constraints must be respected.
 */
export declare function performAccountDeletion(orgId: string): Promise<void>;
export default router;
//# sourceMappingURL=account.d.ts.map