import { query } from '../config/database';

export interface CalendarData {
  name: string;
  agentId?: string | null;
  timezone?: string;
  availableDays?: number[];
  availableHours?: { start: string; end: string };
  slotDuration?: number;
  bufferMinutes?: number;
  maxAdvanceDays?: number;
}

export interface CalendarRow {
  id: string;
  organization_id: string;
  agent_id: string | null;
  name: string;
  timezone: string;
  available_days: number[];
  available_hours: { start: string; end: string };
  slot_duration: number;
  buffer_minutes: number;
  max_advance_days: number;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export async function createCalendar(orgId: string, data: CalendarData): Promise<CalendarRow> {
  const {
    name,
    agentId = null,
    timezone = 'UTC',
    availableDays = [1, 2, 3, 4, 5],
    availableHours = { start: '09:00', end: '17:00' },
    slotDuration = 30,
    bufferMinutes = 15,
    maxAdvanceDays = 30,
  } = data;

  const result = await query<CalendarRow>(
    `INSERT INTO calendars
       (organization_id, agent_id, name, timezone, available_days, available_hours,
        slot_duration, buffer_minutes, max_advance_days)
     VALUES ($1, $2, $3, $4, $5::integer[], $6::jsonb, $7, $8, $9)
     RETURNING *`,
    [
      orgId,
      agentId,
      name,
      timezone,
      availableDays,
      JSON.stringify(availableHours),
      slotDuration,
      bufferMinutes,
      maxAdvanceDays,
    ]
  );
  return result.rows[0]!;
}

export async function getCalendars(orgId: string): Promise<CalendarRow[]> {
  const result = await query<CalendarRow>(
    'SELECT * FROM calendars WHERE organization_id = $1 ORDER BY created_at DESC',
    [orgId]
  );
  return result.rows;
}

export async function getCalendar(orgId: string, calendarId: string): Promise<CalendarRow | null> {
  const result = await query<CalendarRow>(
    'SELECT * FROM calendars WHERE id = $1 AND organization_id = $2',
    [calendarId, orgId]
  );
  return result.rows[0] ?? null;
}

export async function updateCalendar(
  orgId: string,
  calendarId: string,
  data: Partial<CalendarData>
): Promise<CalendarRow | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.agentId !== undefined) {
    setClauses.push(`agent_id = $${idx++}`);
    values.push(data.agentId);
  }
  if (data.timezone !== undefined) {
    setClauses.push(`timezone = $${idx++}`);
    values.push(data.timezone);
  }
  if (data.availableDays !== undefined) {
    setClauses.push(`available_days = $${idx++}::integer[]`);
    values.push(data.availableDays);
  }
  if (data.availableHours !== undefined) {
    setClauses.push(`available_hours = $${idx++}::jsonb`);
    values.push(JSON.stringify(data.availableHours));
  }
  if (data.slotDuration !== undefined) {
    setClauses.push(`slot_duration = $${idx++}`);
    values.push(data.slotDuration);
  }
  if (data.bufferMinutes !== undefined) {
    setClauses.push(`buffer_minutes = $${idx++}`);
    values.push(data.bufferMinutes);
  }
  if (data.maxAdvanceDays !== undefined) {
    setClauses.push(`max_advance_days = $${idx++}`);
    values.push(data.maxAdvanceDays);
  }

  values.push(calendarId, orgId);
  const result = await query<CalendarRow>(
    `UPDATE calendars SET ${setClauses.join(', ')}
     WHERE id = $${idx++} AND organization_id = $${idx}
     RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteCalendar(orgId: string, calendarId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM calendars WHERE id = $1 AND organization_id = $2',
    [calendarId, orgId]
  );
  return (result.rowCount ?? 0) > 0;
}

/** Returns available time slots for a calendar on a given date (YYYY-MM-DD).
 *  All slot times are in the calendar's local timezone. */
export async function getAvailableSlots(
  calendarId: string,
  date: string
): Promise<TimeSlot[]> {
  const calResult = await query<CalendarRow>(
    'SELECT * FROM calendars WHERE id = $1',
    [calendarId]
  );
  const cal = calResult.rows[0];
  if (!cal) return [];

  const tz = cal.timezone || 'UTC';

  // Parse date — compute day-of-week via UTC to avoid locale issues
  const dateParts = date.split('-').map(Number);
  if (dateParts.length !== 3) return [];
  const [year, month, day] = dateParts as [number, number, number];
  const targetDate = new Date(Date.UTC(year, month - 1, day));

  // JS getDay() returns 0=Sun,1=Mon...6=Sat; spec uses 1=Mon...7=Sun
  const jsDay = targetDate.getUTCDay();
  const specDay = jsDay === 0 ? 7 : jsDay;

  if (!cal.available_days.includes(specDay)) return [];

  // Check max_advance_days (UTC-based approximation — good enough for this check)
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.floor((targetDate.getTime() - todayUTC.getTime()) / 86400000);
  if (diffDays < 0 || diffDays > cal.max_advance_days) return [];

  // Generate all slots (times are in calendar's local timezone)
  const hours = cal.available_hours as { start: string; end: string };
  const [startH, startM] = hours.start.split(':').map(Number) as [number, number];
  const [endH, endM] = hours.end.split(':').map(Number) as [number, number];
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const rawSlots: TimeSlot[] = [];
  let cursor = startMinutes;
  while (cursor + cal.slot_duration <= endMinutes) {
    rawSlots.push({
      start: minutesToHHMM(cursor),
      end: minutesToHHMM(cursor + cal.slot_duration),
    });
    cursor += cal.slot_duration + cal.buffer_minutes;
  }

  // Fetch booked appointments — filter by date in the calendar's timezone
  const bookedResult = await query<{ start_time: string; end_time: string }>(
    `SELECT start_time, end_time FROM appointments
     WHERE calendar_id = $1
       AND (start_time AT TIME ZONE $3)::date = $2::date
       AND status != 'cancelled'`,
    [calendarId, date, tz]
  );

  // Convert booked UTC times to calendar-local HH:MM for comparison
  const booked = bookedResult.rows.map((r) => ({
    start: timeToMinutes(toLocalHHMM(new Date(r.start_time), tz)),
    end: timeToMinutes(toLocalHHMM(new Date(r.end_time), tz)),
  }));

  // Get current time in calendar's local timezone for "past slot" filtering
  const now = new Date();
  const todayLocalStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const nowHHMM = toLocalHHMM(now, tz);
  const nowMinutes = timeToMinutes(nowHHMM);

  return rawSlots.filter((slot) => {
    const slotStartMin = timeToMinutes(slot.start);
    const slotEndMin = timeToMinutes(slot.end);

    // Skip past slots for today (in calendar's timezone)
    if (date === todayLocalStr && slotStartMin <= nowMinutes) return false;

    // Skip overlapping booked slots
    return !booked.some((b) => slotStartMin < b.end && slotEndMin > b.start);
  });
}

/**
 * Converts a wall-clock date+time in the given timezone to a UTC Date.
 * Example: localTimeToUTC('2026-03-04', '14:00', 'America/Bogota')
 *          → 2026-03-04T19:00:00.000Z  (Bogota is UTC-5)
 */
export function localTimeToUTC(date: string, time: string, timezone: string): Date {
  const dateTimeStr = `${date}T${time}:00`;
  // Parse the naive date-time (server runs UTC, so treated as UTC here)
  const naiveDate = new Date(dateTimeStr);
  // Compute the offset between UTC and the target timezone at this moment
  const utcParsed = new Date(naiveDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzParsed = new Date(naiveDate.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = utcParsed.getTime() - tzParsed.getTime();
  return new Date(naiveDate.getTime() + offsetMs);
}

/** Formats a UTC Date as HH:MM in the given timezone (24h). */
function toLocalHHMM(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h === '24' ? '00' : h}:${m}`;
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}
