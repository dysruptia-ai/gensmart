/**
 * Appointment Reminder Worker
 *
 * Runs every 5 minutes. Checks for appointments starting within the next 30 minutes
 * that haven't had a reminder sent yet. Marks reminder_sent = true and emits an
 * in-app notification via WebSocket.
 *
 * Also runs daily cleanup tasks:
 * - Expire old data exports (after 7 days)
 * - Execute scheduled account deletions (after 30-day grace period)
 */
import path from 'path';
import fs from 'fs';
import { query } from '../config/database';

interface AppointmentReminder {
  id: string;
  organization_id: string;
  title: string;
  start_time: string;
  contact_name: string | null;
}

async function checkReminders(): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now

  const result = await query<AppointmentReminder>(
    `SELECT a.id, a.organization_id, a.title, a.start_time, c.name AS contact_name
     FROM appointments a
     LEFT JOIN contacts c ON c.id = a.contact_id
     WHERE a.status = 'scheduled'
       AND a.reminder_sent = false
       AND a.start_time >= $1::timestamptz
       AND a.start_time <= $2::timestamptz`,
    [now.toISOString(), windowEnd.toISOString()]
  );

  if (!result.rows.length) return;

  for (const appt of result.rows) {
    try {
      // Mark reminder as sent
      await query(
        'UPDATE appointments SET reminder_sent = true, updated_at = NOW() WHERE id = $1',
        [appt.id]
      );

      // Emit in-app WebSocket notification (if available)
      try {
        const { getIO } = await import('../config/websocket');
        const io = getIO();
        const startDate = new Date(appt.start_time);
        const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        io.to(`org:${appt.organization_id}`).emit('appointment:reminder', {
          appointmentId: appt.id,
          title: appt.title,
          startTime: appt.start_time,
          message: `Reminder: "${appt.title}" is scheduled at ${timeStr}${appt.contact_name ? ` with ${appt.contact_name}` : ''}`,
        });
      } catch {
        // WebSocket not initialized or not available — notification will be skipped
      }

      console.log(`[reminder-worker] Reminder sent for appointment: ${appt.id} (${appt.title})`);
    } catch (err) {
      console.error(`[reminder-worker] Error processing reminder for ${appt.id}:`, (err as Error).message);
    }
  }
}

let lastCleanupDate = '';

async function runDailyCleanup(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  if (today === lastCleanupDate) return; // Already ran today
  lastCleanupDate = today;

  // 1. Mark expired data exports and delete their files
  try {
    const expired = await query<{ id: string; file_path: string | null }>(
      `UPDATE data_export_requests SET status = 'expired'
       WHERE status = 'completed' AND expires_at < NOW()
       RETURNING id, file_path`
    );
    for (const row of expired.rows) {
      if (row.file_path && fs.existsSync(row.file_path)) {
        try {
          fs.unlinkSync(row.file_path);
          console.log(`[cleanup] Deleted expired export file: ${path.basename(row.file_path)}`);
        } catch {
          // Non-critical
        }
      }
    }
    if (expired.rows.length > 0) {
      console.log(`[cleanup] Expired ${expired.rows.length} data export(s)`);
    }
  } catch (err) {
    console.error('[cleanup] Failed to expire data exports:', (err as Error).message);
  }

  // 2. Execute scheduled account deletions that are past their grace period
  try {
    const due = await query<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM account_deletion_requests
       WHERE status = 'pending' AND scheduled_at <= NOW()`
    );

    for (const req of due.rows) {
      try {
        const { performAccountDeletion } = await import('../routes/account');
        await performAccountDeletion(req.organization_id);
        await query(
          `UPDATE account_deletion_requests SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [req.id]
        );
        console.log(`[cleanup] Deleted organization ${req.organization_id} (scheduled deletion)`);
      } catch (deleteErr) {
        console.error(`[cleanup] Failed to delete org ${req.organization_id}:`, (deleteErr as Error).message);
      }
    }
  } catch (err) {
    console.error('[cleanup] Failed to process scheduled deletions:', (err as Error).message);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderWorker(): void {
  console.log('[reminder-worker] Started — checking every 5 minutes');

  // Run immediately on start
  void checkReminders().catch((err) =>
    console.error('[reminder-worker] Initial check failed:', (err as Error).message)
  );
  void runDailyCleanup().catch((err) =>
    console.error('[reminder-worker] Initial cleanup failed:', (err as Error).message)
  );

  // Then every 5 minutes
  reminderInterval = setInterval(() => {
    void checkReminders().catch((err) =>
      console.error('[reminder-worker] Check failed:', (err as Error).message)
    );
    void runDailyCleanup().catch((err) =>
      console.error('[reminder-worker] Cleanup failed:', (err as Error).message)
    );
  }, 5 * 60 * 1000);
}

export function stopReminderWorker(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
