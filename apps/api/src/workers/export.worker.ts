/**
 * Data Export Worker
 *
 * BullMQ worker for the 'data-export' queue.
 * Assembles all organization data into a ZIP file for GDPR data portability.
 */
import path from 'path';
import fs from 'fs';
import { Worker } from 'bullmq';
import archiver from 'archiver';
import { query } from '../config/database';
import { createBullConnection } from '../config/queues';

interface ExportJobData {
  exportRequestId: string;
  organizationId: string;
}

async function processExport(exportRequestId: string, organizationId: string): Promise<void> {
  // Mark as processing
  await query(
    `UPDATE data_export_requests SET status = 'processing' WHERE id = $1`,
    [exportRequestId]
  );

  // Ensure exports directory exists
  const exportsDir = path.join(process.cwd(), 'uploads', 'exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

  const zipPath = path.join(exportsDir, `${exportRequestId}.zip`);

  // Collect all organization data
  const [orgResult, usersResult, agentsResult, agentToolsResult, knowledgeResult,
    contactsResult, conversationsResult, messagesResult, calendarsResult,
    appointmentsResult, billingResult, notificationsResult] = await Promise.all([
    query(
      `SELECT id, name, slug, plan, subscription_status, settings, created_at
       FROM organizations WHERE id = $1`,
      [organizationId]
    ),
    query(
      `SELECT id, name, email, role, language, created_at, last_login_at
       FROM users WHERE organization_id = $1`,
      [organizationId]
    ),
    query(
      `SELECT id, name, description, type, status, channels, model, temperature,
              max_tokens, context_window, system_prompt, web_config, created_at, updated_at
       FROM agents WHERE organization_id = $1`,
      [organizationId]
    ),
    query(
      `SELECT at.id, at.agent_id, at.tool_type, at.tool_name, at.enabled, at.created_at
       FROM agent_tools at
       JOIN agents a ON a.id = at.agent_id
       WHERE a.organization_id = $1`,
      [organizationId]
    ),
    query(
      `SELECT kf.id, kf.agent_id, kf.file_name, kf.file_type, kf.status,
              kf.chunk_count, kf.source_url, kf.created_at
       FROM knowledge_files kf
       JOIN agents a ON a.id = kf.agent_id
       WHERE a.organization_id = $1`,
      [organizationId]
    ),
    query(
      `SELECT id, name, email, phone, ai_score, ai_service, ai_summary,
              funnel_stage, notes, custom_variables, created_at
       FROM contacts WHERE organization_id = $1 ORDER BY created_at`,
      [organizationId]
    ),
    query(
      `SELECT id, agent_id, contact_id, channel, status, is_human_controlled,
              created_at, updated_at, closed_at
       FROM conversations WHERE organization_id = $1 ORDER BY created_at`,
      [organizationId]
    ),
    query(
      `SELECT m.id, m.conversation_id, m.role, m.content, m.created_at
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.organization_id = $1
       ORDER BY m.created_at`,
      [organizationId]
    ),
    query(
      `SELECT id, name, timezone, available_days, available_hours,
              slot_duration_minutes, buffer_minutes, max_advance_days, created_at
       FROM calendars WHERE organization_id = $1`,
      [organizationId]
    ),
    query(
      `SELECT a.id, a.calendar_id, a.contact_id, a.title, a.status,
              a.start_time, a.end_time, a.notes, a.created_at
       FROM appointments a
       JOIN calendars cal ON cal.id = a.calendar_id
       WHERE cal.organization_id = $1 ORDER BY a.start_time`,
      [organizationId]
    ),
    query(
      `SELECT id, event_type, stripe_event_id, amount, currency, description, created_at
       FROM billing_events WHERE organization_id = $1 ORDER BY created_at`,
      [organizationId]
    ),
    query(
      `SELECT id, type, title, message, is_read, created_at
       FROM notifications WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 500`,
      [organizationId]
    ),
  ]);

  // Build contacts CSV
  const csvHeader = 'name,email,phone,score,service,funnel_stage,notes,created_at\n';
  const csvRows = contactsResult.rows.map((c: Record<string, unknown>) => {
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [
      escape(c['name']), escape(c['email']), escape(c['phone']),
      escape(c['ai_score']), escape(c['ai_service']), escape(c['funnel_stage']),
      escape(c['notes']), escape(c['created_at']),
    ].join(',');
  });
  const contactsCsv = csvHeader + csvRows.join('\n');

  // Group messages into conversations
  const messagesByConv: Record<string, unknown[]> = {};
  for (const msg of messagesResult.rows) {
    const convId = String((msg as Record<string, unknown>)['conversation_id']);
    if (!messagesByConv[convId]) messagesByConv[convId] = [];
    messagesByConv[convId].push(msg);
  }

  const conversationsWithMessages = conversationsResult.rows.map((conv: Record<string, unknown>) => ({
    ...conv,
    messages: messagesByConv[String(conv['id'])] ?? [],
  }));

  // Assemble ZIP
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(JSON.stringify(orgResult.rows[0] ?? {}, null, 2), { name: 'organization.json' });
    archive.append(JSON.stringify(usersResult.rows, null, 2), { name: 'users.json' });
    archive.append(JSON.stringify(agentsResult.rows, null, 2), { name: 'agents.json' });
    archive.append(JSON.stringify(agentToolsResult.rows, null, 2), { name: 'agent_tools.json' });
    archive.append(JSON.stringify(knowledgeResult.rows, null, 2), { name: 'knowledge_files.json' });
    archive.append(contactsCsv, { name: 'contacts.csv' });
    archive.append(JSON.stringify(conversationsWithMessages, null, 2), { name: 'conversations.json' });
    archive.append(JSON.stringify(calendarsResult.rows, null, 2), { name: 'calendars.json' });
    archive.append(JSON.stringify(appointmentsResult.rows, null, 2), { name: 'appointments.json' });
    archive.append(JSON.stringify(billingResult.rows, null, 2), { name: 'billing.json' });
    archive.append(JSON.stringify(notificationsResult.rows, null, 2), { name: 'notifications.json' });
    archive.append(
      JSON.stringify({ exportedAt: new Date().toISOString(), version: '1.0', organizationId }, null, 2),
      { name: 'README.json' }
    );

    archive.finalize();
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await query(
    `UPDATE data_export_requests
     SET status = 'completed', file_path = $1, expires_at = $2
     WHERE id = $3`,
    [zipPath, expiresAt.toISOString(), exportRequestId]
  );

  // Create in-app notification
  try {
    // Find org owner/admin to notify
    const ownerResult = await query<{ id: string }>(
      `SELECT id FROM users WHERE organization_id = $1 AND role IN ('owner', 'admin') LIMIT 1`,
      [organizationId]
    );
    const userId = ownerResult.rows[0]?.id;
    if (userId) {
      await query(
        `INSERT INTO notifications (id, organization_id, user_id, type, title, message, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'data_export_ready', $3, $4, NOW())`,
        [
          organizationId,
          userId,
          'Data Export Ready',
          'Your data export has been prepared. Download it from Settings > Data & Privacy.',
        ]
      );
      // Emit WebSocket event
      try {
        const { getIO } = await import('../config/websocket');
        getIO().to(`org:${organizationId}`).emit('notification:new', {
          type: 'data_export_ready',
          title: 'Data Export Ready',
          message: 'Your data export is ready to download.',
        });
      } catch {
        // WebSocket not available
      }
    }
  } catch (err) {
    console.error('[export-worker] Failed to create notification:', (err as Error).message);
  }

  console.log(`[export-worker] Export completed: ${exportRequestId} (${zipPath})`);
}

export function startExportWorker(): void {
  const worker = new Worker<ExportJobData>(
    'data-export',
    async (job) => {
      const { exportRequestId, organizationId } = job.data;
      console.log(`[export-worker] Processing export ${exportRequestId} for org ${organizationId}`);

      try {
        await processExport(exportRequestId, organizationId);
      } catch (err) {
        console.error(`[export-worker] Export failed ${exportRequestId}:`, (err as Error).message);
        await query(
          `UPDATE data_export_requests SET status = 'failed' WHERE id = $1`,
          [exportRequestId]
        ).catch(() => null);
        throw err;
      }
    },
    {
      connection: createBullConnection(),
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[export-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[export-worker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[export-worker] Started — listening for data-export jobs');
}
