"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReminderWorker = startReminderWorker;
exports.stopReminderWorker = stopReminderWorker;
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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("../config/database");
async function checkReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now
    const result = await (0, database_1.query)(`SELECT a.id, a.organization_id, a.title, a.start_time, c.name AS contact_name
     FROM appointments a
     LEFT JOIN contacts c ON c.id = a.contact_id
     WHERE a.status = 'scheduled'
       AND a.reminder_sent = false
       AND a.start_time >= $1::timestamptz
       AND a.start_time <= $2::timestamptz`, [now.toISOString(), windowEnd.toISOString()]);
    if (!result.rows.length)
        return;
    for (const appt of result.rows) {
        try {
            // Mark reminder as sent
            await (0, database_1.query)('UPDATE appointments SET reminder_sent = true, updated_at = NOW() WHERE id = $1', [appt.id]);
            // Emit in-app WebSocket notification (if available)
            try {
                const { getIO } = await Promise.resolve().then(() => __importStar(require('../config/websocket')));
                const io = getIO();
                const startDate = new Date(appt.start_time);
                const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                io.to(`org:${appt.organization_id}`).emit('appointment:reminder', {
                    appointmentId: appt.id,
                    title: appt.title,
                    startTime: appt.start_time,
                    message: `Reminder: "${appt.title}" is scheduled at ${timeStr}${appt.contact_name ? ` with ${appt.contact_name}` : ''}`,
                });
            }
            catch {
                // WebSocket not initialized or not available — notification will be skipped
            }
            console.log(`[reminder-worker] Reminder sent for appointment: ${appt.id} (${appt.title})`);
        }
        catch (err) {
            console.error(`[reminder-worker] Error processing reminder for ${appt.id}:`, err.message);
        }
    }
}
let lastCleanupDate = '';
async function runDailyCleanup() {
    const today = new Date().toISOString().split('T')[0];
    if (today === lastCleanupDate)
        return; // Already ran today
    lastCleanupDate = today;
    // 1. Mark expired data exports and delete their files
    try {
        const expired = await (0, database_1.query)(`UPDATE data_export_requests SET status = 'expired'
       WHERE status = 'completed' AND expires_at < NOW()
       RETURNING id, file_path`);
        for (const row of expired.rows) {
            if (row.file_path && fs_1.default.existsSync(row.file_path)) {
                try {
                    fs_1.default.unlinkSync(row.file_path);
                    console.log(`[cleanup] Deleted expired export file: ${path_1.default.basename(row.file_path)}`);
                }
                catch {
                    // Non-critical
                }
            }
        }
        if (expired.rows.length > 0) {
            console.log(`[cleanup] Expired ${expired.rows.length} data export(s)`);
        }
    }
    catch (err) {
        console.error('[cleanup] Failed to expire data exports:', err.message);
    }
    // 2. Execute scheduled account deletions that are past their grace period
    try {
        const due = await (0, database_1.query)(`SELECT id, organization_id FROM account_deletion_requests
       WHERE status = 'pending' AND scheduled_at <= NOW()`);
        for (const req of due.rows) {
            try {
                const { performAccountDeletion } = await Promise.resolve().then(() => __importStar(require('../routes/account')));
                await performAccountDeletion(req.organization_id);
                await (0, database_1.query)(`UPDATE account_deletion_requests SET status = 'completed', completed_at = NOW() WHERE id = $1`, [req.id]);
                console.log(`[cleanup] Deleted organization ${req.organization_id} (scheduled deletion)`);
            }
            catch (deleteErr) {
                console.error(`[cleanup] Failed to delete org ${req.organization_id}:`, deleteErr.message);
            }
        }
    }
    catch (err) {
        console.error('[cleanup] Failed to process scheduled deletions:', err.message);
    }
}
let reminderInterval = null;
function startReminderWorker() {
    console.log('[reminder-worker] Started — checking every 5 minutes');
    // Run immediately on start
    void checkReminders().catch((err) => console.error('[reminder-worker] Initial check failed:', err.message));
    void runDailyCleanup().catch((err) => console.error('[reminder-worker] Initial cleanup failed:', err.message));
    // Then every 5 minutes
    reminderInterval = setInterval(() => {
        void checkReminders().catch((err) => console.error('[reminder-worker] Check failed:', err.message));
        void runDailyCleanup().catch((err) => console.error('[reminder-worker] Cleanup failed:', err.message));
    }, 5 * 60 * 1000);
}
function stopReminderWorker() {
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
    }
}
//# sourceMappingURL=reminder.worker.js.map