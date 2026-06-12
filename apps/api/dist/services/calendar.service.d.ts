export interface CalendarData {
    name: string;
    agentId?: string | null;
    timezone?: string;
    availableDays?: number[];
    availableHours?: {
        start: string;
        end: string;
    };
    slotDuration?: number;
    bufferMinutes?: number;
    maxAdvanceDays?: number;
    notificationEmail?: string | null;
}
export interface CalendarRow {
    id: string;
    organization_id: string;
    agent_id: string | null;
    name: string;
    timezone: string;
    available_days: number[];
    available_hours: {
        start: string;
        end: string;
    };
    slot_duration: number;
    buffer_minutes: number;
    max_advance_days: number;
    notification_email: string | null;
    created_at: string;
    updated_at: string;
}
export interface TimeSlot {
    start: string;
    end: string;
}
/**
 * Resolves calendar IDs from a scheduling tool config.
 * Supports both new format (calendar_ids: string[]) and legacy (calendar_id: string).
 */
export declare function resolveCalendarIds(toolConfig: Record<string, unknown>): string[];
export declare function createCalendar(orgId: string, data: CalendarData): Promise<CalendarRow>;
export declare function getCalendars(orgId: string): Promise<CalendarRow[]>;
export declare function getCalendar(orgId: string, calendarId: string): Promise<CalendarRow | null>;
export declare function updateCalendar(orgId: string, calendarId: string, data: Partial<CalendarData>): Promise<CalendarRow | null>;
export declare function deleteCalendar(orgId: string, calendarId: string): Promise<boolean>;
/** Returns available time slots for a calendar on a given date (YYYY-MM-DD).
 *  All slot times are in the calendar's local timezone. */
export declare function getAvailableSlots(calendarId: string, date: string): Promise<TimeSlot[]>;
/**
 * Converts a wall-clock date+time in the given timezone to a UTC Date.
 * Example: localTimeToUTC('2026-03-06', '09:00', 'America/Bogota')
 *          → 2026-03-06T14:00:00.000Z  (Bogota is UTC-5, so 9AM local = 2PM UTC)
 *
 * Uses Date.UTC() as anchor to avoid server-local-timezone dependency,
 * and Intl.DateTimeFormat.formatToParts() to read the offset without
 * relying on locale-string parsing (which is ambiguous for non-ISO formats).
 */
export declare function localTimeToUTC(date: string, time: string, timezone: string): Date;
//# sourceMappingURL=calendar.service.d.ts.map