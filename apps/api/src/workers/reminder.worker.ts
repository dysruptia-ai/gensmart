/**
 * Appointment Reminder Worker
 *
 * Runs every 5 minutes. Checks for appointments starting within the next 30 minutes
 * that haven't had a reminder sent yet. Marks reminder_sent = true and emits an
 * in-app notification via WebSocket.
 */
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

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderWorker(): void {
  console.log('[reminder-worker] Started — checking every 5 minutes');

  // Run immediately on start
  void checkReminders().catch((err) =>
    console.error('[reminder-worker] Initial check failed:', (err as Error).message)
  );

  // Then every 5 minutes
  reminderInterval = setInterval(() => {
    void checkReminders().catch((err) =>
      console.error('[reminder-worker] Check failed:', (err as Error).message)
    );
  }, 5 * 60 * 1000);
}

export function stopReminderWorker(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
