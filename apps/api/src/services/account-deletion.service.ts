import path from 'path';
import fs from 'fs';
import { query, getClient } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { avatarFilenameFromUrl, unlinkInside } from './upload-paths';
import { disconnectOrg } from '../config/websocket';

/** An organization with sub-accounts cannot be deleted until they are removed. Throws 409 HAS_SUB_ACCOUNTS. */
export async function assertNoSubAccounts(orgId: string): Promise<void> {
  const result = await query(
    'SELECT 1 FROM sub_accounts WHERE parent_organization_id = $1 LIMIT 1',
    [orgId]
  );
  if ((result.rowCount ?? result.rows.length) > 0) {
    throw new AppError(409, 'Remove the sub-accounts before deleting this account', 'HAS_SUB_ACCOUNTS');
  }
}

/**
 * Performs the full account deletion in a transaction.
 * Order matters — foreign key constraints must be respected.
 */
export async function performAccountDeletion(orgId: string): Promise<void> {
  // Before any effect (Stripe, transaction): a parent with sub-accounts is not deleted
  await assertNoSubAccounts(orgId);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Cancel Stripe subscription if still active
    try {
      const orgResult = await client.query<{ stripe_subscription_id: string | null }>(
        'SELECT stripe_subscription_id FROM organizations WHERE id = $1',
        [orgId]
      );
      const stripeSubId = orgResult.rows[0]?.stripe_subscription_id;
      if (stripeSubId) {
        const { stripe } = await import('../config/stripe');
        await stripe.subscriptions.cancel(stripeSubId).catch(() => null);
      }
    } catch {
      // Non-blocking — continue with deletion
    }

    // 2. Get all conversation IDs (needed to delete messages)
    const convsResult = await client.query<{ id: string }>(
      'SELECT id FROM conversations WHERE organization_id = $1',
      [orgId]
    );
    const convIds = convsResult.rows.map((r) => r.id);

    // 3. Delete messages
    if (convIds.length > 0) {
      await client.query(
        `DELETE FROM messages WHERE conversation_id = ANY($1::uuid[])`,
        [convIds]
      );
    }

    // 4. Get all agent IDs
    const agentsResult = await client.query<{ id: string }>(
      'SELECT id FROM agents WHERE organization_id = $1',
      [orgId]
    );
    const agentIds = agentsResult.rows.map((r) => r.id);

    // Files on disk that belong to this organization: collected now, deleted after the COMMIT
    const knowledgeFilePaths: string[] = [];
    const avatarUrls: string[] = [];
    if (agentIds.length > 0) {
      const kfPaths = await client.query<{ file_path: string | null }>(
        'SELECT file_path FROM knowledge_files WHERE agent_id = ANY($1::uuid[])',
        [agentIds]
      );
      for (const r of kfPaths.rows) if (r.file_path) knowledgeFilePaths.push(r.file_path);
      const avatars = await client.query<{ avatar_url: string | null }>(
        'SELECT avatar_url FROM agents WHERE organization_id = $1 AND avatar_url IS NOT NULL',
        [orgId]
      );
      for (const r of avatars.rows) if (r.avatar_url) avatarUrls.push(r.avatar_url);
    }

    // 5. Delete knowledge chunks
    if (agentIds.length > 0) {
      const kfResult = await client.query<{ id: string }>(
        `SELECT id FROM knowledge_files WHERE agent_id = ANY($1::uuid[])`,
        [agentIds]
      );
      const kfIds = kfResult.rows.map((r) => r.id);
      if (kfIds.length > 0) {
        await client.query(
          `DELETE FROM knowledge_chunks WHERE knowledge_file_id = ANY($1::uuid[])`,
          [kfIds]
        );
      }
    }

    // 6. Delete in dependency order
    await client.query('DELETE FROM conversations WHERE organization_id = $1', [orgId]);
    await client.query(
      agentIds.length > 0
        ? `DELETE FROM knowledge_files WHERE agent_id = ANY($1::uuid[])`
        : 'SELECT 1',
      agentIds.length > 0 ? [agentIds] : []
    );
    await client.query(
      agentIds.length > 0
        ? `DELETE FROM agent_tools WHERE agent_id = ANY($1::uuid[])`
        : 'SELECT 1',
      agentIds.length > 0 ? [agentIds] : []
    );
    await client.query(
      agentIds.length > 0
        ? `DELETE FROM agent_versions WHERE agent_id = ANY($1::uuid[])`
        : 'SELECT 1',
      agentIds.length > 0 ? [agentIds] : []
    );
    await client.query('DELETE FROM agents WHERE organization_id = $1', [orgId]);
    await client.query('DELETE FROM contacts WHERE organization_id = $1', [orgId]);

    // Delete calendars + appointments
    const calResult = await client.query<{ id: string }>(
      'SELECT id FROM calendars WHERE organization_id = $1',
      [orgId]
    );
    const calIds = calResult.rows.map((r) => r.id);
    if (calIds.length > 0) {
      await client.query(
        `DELETE FROM appointments WHERE calendar_id = ANY($1::uuid[])`,
        [calIds]
      );
    }
    await client.query('DELETE FROM calendars WHERE organization_id = $1', [orgId]);

    // Delete user-related data. Only users with no membership in another organization are deleted:
    // the rest keep their account, tokens and 2FA codes (they are repointed below).
    const usersResult = await client.query<{ id: string }>(
      `SELECT u.id FROM users u
       WHERE u.organization_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM user_organizations uo WHERE uo.user_id = u.id AND uo.organization_id <> $1
         )`,
      [orgId]
    );
    const userIds = usersResult.rows.map((r) => r.id);

    if (userIds.length > 0) {
      await client.query(
        `DELETE FROM refresh_tokens WHERE user_id = ANY($1::uuid[])`,
        [userIds]
      );
      await client.query(
        `DELETE FROM backup_codes WHERE user_id = ANY($1::uuid[])`,
        [userIds]
      );
      await client.query(
        `DELETE FROM password_resets WHERE user_id = ANY($1::uuid[])`,
        [userIds]
      );
    }

    await client.query('DELETE FROM notifications WHERE organization_id = $1', [orgId]);
    await client.query('DELETE FROM billing_events WHERE organization_id = $1', [orgId]);
    // Export ZIPs are named after the request id, so collect the stored paths before the rows go away.
    const exportFilesResult = await client.query<{ file_path: string | null }>(
      'SELECT file_path FROM data_export_requests WHERE organization_id = $1',
      [orgId]
    );
    const exportFilePaths = exportFilesResult.rows
      .map((r) => r.file_path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    await client.query('DELETE FROM data_export_requests WHERE organization_id = $1', [orgId]);
    await client.query('DELETE FROM account_deletion_requests WHERE organization_id = $1', [orgId]);

    // Sub-accounts
    await client.query(
      `DELETE FROM sub_accounts WHERE parent_organization_id = $1 OR child_organization_id = $1`,
      [orgId]
    );

    // Memberships of this organization go away; users that belong elsewhere are repointed to their
    // oldest remaining membership (users.organization_id cascades on organization delete, so this
    // must happen before the organization row is removed).
    await client.query('DELETE FROM user_organizations WHERE organization_id = $1', [orgId]);
    await client.query(
      `UPDATE users u
       SET organization_id = m.organization_id, role = m.role, updated_at = NOW()
       FROM (
         SELECT DISTINCT ON (user_id) user_id, organization_id, role
         FROM user_organizations
         WHERE organization_id <> $1
         ORDER BY user_id, created_at ASC
       ) m
       WHERE u.id = m.user_id AND u.organization_id = $1`,
      [orgId]
    );
    if (userIds.length > 0) {
      await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }
    await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);

    await client.query('COMMIT');

    // Nobody stays connected to the rooms of a deleted organization (never fails the deletion)
    void disconnectOrg(orgId).catch(() => undefined);

    // Clean up export files
    const exportsDir = path.resolve(process.cwd(), 'uploads', 'exports');
    for (const filePath of exportFilePaths) {
      try {
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(exportsDir + path.sep)) continue; // never delete outside uploads/exports
        fs.unlinkSync(resolved);
      } catch {
        // Non-critical: a missing or undeletable file must not affect the response
      }
    }

    // Knowledge documents and avatars (skipping any file another row still references)
    const knowledgeDir = path.join(process.cwd(), 'uploads', 'knowledge');
    for (const filePath of knowledgeFilePaths) {
      try {
        const stillUsed = await query('SELECT 1 FROM knowledge_files WHERE file_path = $1 LIMIT 1', [filePath]);
        if ((stillUsed.rowCount ?? 0) === 0) await unlinkInside(filePath, knowledgeDir);
      } catch {
        // Non-critical
      }
    }
    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    const apiBase = process.env['API_BASE_URL'] ?? 'http://localhost:4000';
    for (const avatarUrl of avatarUrls) {
      try {
        const filename = avatarFilenameFromUrl(avatarUrl, apiBase);
        if (!filename) continue;
        const stillUsed = await query('SELECT 1 FROM agents WHERE avatar_url = $1 LIMIT 1', [avatarUrl]);
        if ((stillUsed.rowCount ?? 0) === 0) await unlinkInside(path.join(avatarsDir, filename), avatarsDir);
      } catch {
        // Non-critical
      }
    }

    console.log(`[account] Organization ${orgId} deleted successfully`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
