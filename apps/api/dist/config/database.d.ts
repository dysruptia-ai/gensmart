import { Pool, PoolClient } from 'pg';
export declare const pool: Pool;
export declare function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{
    rows: T[];
    rowCount: number | null;
}>;
export declare function getClient(): Promise<PoolClient>;
//# sourceMappingURL=database.d.ts.map