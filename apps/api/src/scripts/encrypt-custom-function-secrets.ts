/**
 * Encrypts in place the credentials of custom_function tools that are still stored in plaintext
 * (auth.token, auth.apiKey and sensitive header values) as "enc:v1:" + ciphertext, both in
 * agent_tools.config and in the snapshots of published versions (agent_versions.tools).
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

interface VersionRow {
  id: string;
  tools: unknown;
}

export interface ToolStore {
  listCustomFunctionTools(): Promise<ToolRow[]>;
  /** Writes only when the stored config is still the one that was read (no clobbering of a concurrent edit). */
  replaceConfig(id: string, previous: Record<string, unknown>, next: Record<string, unknown>): Promise<boolean>;
  /** Published versions: agent_versions.tools is an array of copies of agent_tools rows. */
  listVersions(): Promise<VersionRow[]>;
  /** Same guard: writes only when tools is still what was read. */
  replaceVersionTools(id: string, previous: unknown[], next: unknown[]): Promise<boolean>;
}

interface Counts {
  reviewed: number;
  modified: number;
  skippedConcurrent: number;
}

export interface MigrationSummary {
  tools: Counts;
  versions: Counts;
}

/** Encrypts the plaintext credentials of every custom_function element of a version snapshot. */
function encryptSnapshotTools(tools: unknown[]): { tools: unknown[]; changed: boolean } {
  let changed = false;
  const next = tools.map((tool) => {
    const t = tool as { type?: unknown; config?: unknown } | null;
    if (!t || t.type !== 'custom_function' || typeof t.config !== 'object' || t.config === null || Array.isArray(t.config)) {
      return tool;
    }
    const result = encryptPlainSecrets(t.config as Record<string, unknown>);
    if (!result.changed) return tool;
    changed = true;
    return { ...t, config: result.config };
  });
  return { tools: next, changed };
}

export async function encryptCustomFunctionSecrets(
  store: ToolStore,
  options: { dryRun: boolean }
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    tools: { reviewed: 0, modified: 0, skippedConcurrent: 0 },
    versions: { reviewed: 0, modified: 0, skippedConcurrent: 0 },
  };

  for (const tool of await store.listCustomFunctionTools()) {
    summary.tools.reviewed += 1;
    if (!tool.config || typeof tool.config !== 'object') continue;
    const { config, changed } = encryptPlainSecrets(tool.config);
    if (!changed) continue;
    if (options.dryRun) {
      summary.tools.modified += 1;
      continue;
    }
    if (await store.replaceConfig(tool.id, tool.config, config)) summary.tools.modified += 1;
    else summary.tools.skippedConcurrent += 1;
  }

  for (const version of await store.listVersions()) {
    if (!Array.isArray(version.tools)) continue;
    summary.versions.reviewed += 1;
    const { tools, changed } = encryptSnapshotTools(version.tools);
    if (!changed) continue;
    if (options.dryRun) {
      summary.versions.modified += 1;
      continue;
    }
    if (await store.replaceVersionTools(version.id, version.tools, tools)) summary.versions.modified += 1;
    else summary.versions.skippedConcurrent += 1;
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
  async listVersions() {
    const result = await query<VersionRow>("SELECT id, tools FROM agent_versions WHERE jsonb_typeof(tools) = 'array'");
    return result.rows;
  },
  async replaceVersionTools(id, previous, next) {
    const result = await query(
      'UPDATE agent_versions SET tools = $1::jsonb WHERE id = $2 AND tools = $3::jsonb',
      [JSON.stringify(next), id, JSON.stringify(previous)]
    );
    return (result.rowCount ?? 0) === 1;
  },
};

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const summary = await encryptCustomFunctionSecrets(dbStore, { dryRun });
  const verb = dryRun ? 'to modify' : 'modified';
  console.log(`mode:                       ${dryRun ? 'dry-run (nothing written)' : 'write'}`);
  console.log(`agent_tools reviewed:       ${summary.tools.reviewed}`);
  console.log(`agent_tools ${verb}:`.padEnd(28) + summary.tools.modified);
  console.log(`agent_versions reviewed:    ${summary.versions.reviewed}`);
  console.log(`agent_versions ${verb}:`.padEnd(28) + summary.versions.modified);
  const skipped = summary.tools.skippedConcurrent + summary.versions.skippedConcurrent;
  if (skipped > 0) console.log(`skipped (edited meanwhile): ${skipped} — run the script again`);
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
