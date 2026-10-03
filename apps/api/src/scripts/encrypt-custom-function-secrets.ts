/**
 * Encrypts in place the credentials of custom_function tools that are still stored in plaintext
 * (agent_tools.config: auth.token, auth.apiKey and sensitive header values) as "enc:v1:" + ciphertext.
 *
 * Idempotent: values that already start with "enc:v1:" are not touched. Prints only counts, never values.
 *
 * Run:  npm run encrypt:cf-secrets --workspace=apps/api -- --dry-run   (only counts)
 *       npm run encrypt:cf-secrets --workspace=apps/api               (writes)
 */
import { pool, query } from '../config/database';
import { encryptPlainSecrets } from '../services/secret-fields';

interface ToolRow {
  id: string;
  config: Record<string, unknown> | null;
}

export interface ToolStore {
  listCustomFunctionTools(): Promise<ToolRow[]>;
  /** Writes only when the stored config is still the one that was read (no clobbering of a concurrent edit). */
  replaceConfig(id: string, previous: Record<string, unknown>, next: Record<string, unknown>): Promise<boolean>;
}

export interface MigrationSummary {
  reviewed: number;
  modified: number;
  skippedConcurrent: number;
}

export async function encryptCustomFunctionSecrets(
  store: ToolStore,
  options: { dryRun: boolean }
): Promise<MigrationSummary> {
  const tools = await store.listCustomFunctionTools();
  const summary: MigrationSummary = { reviewed: 0, modified: 0, skippedConcurrent: 0 };

  for (const tool of tools) {
    summary.reviewed += 1;
    if (!tool.config || typeof tool.config !== 'object') continue;
    const { config, changed } = encryptPlainSecrets(tool.config);
    if (!changed) continue;
    if (options.dryRun) {
      summary.modified += 1;
      continue;
    }
    if (await store.replaceConfig(tool.id, tool.config, config)) summary.modified += 1;
    else summary.skippedConcurrent += 1;
  }
  return summary;
}

const dbStore: ToolStore = {
  async listCustomFunctionTools() {
    const result = await query<ToolRow>("SELECT id, config FROM agent_tools WHERE type = 'custom_function'");
    return result.rows;
  },
  async replaceConfig(id, previous, next) {
    const result = await query(
      'UPDATE agent_tools SET config = $1::jsonb WHERE id = $2 AND config = $3::jsonb',
      [JSON.stringify(next), id, JSON.stringify(previous)]
    );
    return (result.rowCount ?? 0) === 1;
  },
};

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const summary = await encryptCustomFunctionSecrets(dbStore, { dryRun });
  console.log(`mode:                      ${dryRun ? 'dry-run (nothing written)' : 'write'}`);
  console.log(`tools reviewed:            ${summary.reviewed}`);
  console.log(`${dryRun ? 'tools to modify:' : 'tools modified:  '}          ${summary.modified}`);
  if (summary.skippedConcurrent > 0) {
    console.log(`skipped (edited meanwhile): ${summary.skippedConcurrent} — run the script again`);
  }
}

if (require.main === module) {
  main()
    .catch((err: unknown) => {
      console.error('migration failed:', err instanceof Error ? err.message : 'unknown error');
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
      process.exit(process.exitCode ?? 0);
    });
}
