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
  notificationEmail?: string | null;
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
export function resolveCalendarIds(toolConfig: Record<string, unknown>): string[] {
  const rawCalIds = toolConfig['calendar_ids'] as string[] | undefined;
  const legacyCalId = toolConfig['calendar_id'] as string | undefined;
  return rawCalIds?.length ? rawCalIds : (legacyCalId ? [legacyCalId] : []);
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
    notificationEmail = null,
  } = data;

  const result = await query<CalendarRow>(
    `INSERT INTO calendars
       (organization_id, agent_id, name, timezone, available_days, available_hours,
        slot_duration, buffer_minutes, max_advance_days, notification_email)
     VALUES ($1, $2, $3, $4, $5::integer[], $6::jsonb, $7, $8, $9, $10)
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
      notificationEmail,
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
  if (data.notificationEmail !== undefined) {
    setClauses.push(`notification_email = $${idx++}`);
    values.push(data.notificationEmail);
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
  if (!cal) {
    console.log(`[getAvailableSlots] Calendar not found: ${calendarId}`);
    return [];
  }

  const tz = cal.timezone || 'UTC';
  // Normalize available_days to numbers (pg may return strings in some configs)
  const availableDays = (Array.isArray(cal.available_days) ? cal.available_days : []).map(Number);
  const slotDuration = Number(cal.slot_duration) || 30;
  const bufferMinutes = Number(cal.buffer_minutes) || 0;
  const maxAdvanceDays = Number(cal.max_advance_days) || 30;

  // Parse date — compute day-of-week via UTC
  const dateParts = date.split('-').map(Number);
  if (dateParts.length !== 3) return [];
  const [year, month, day] = dateParts as [number, number, number];
  const targetDate = new Date(Date.UTC(year, month - 1, day));

  // JS getDay(): 0=Sun,1=Mon...6=Sat → spec: 1=Mon..7=Sun
  const jsDay = targetDate.getUTCDay();
  const specDay = jsDay === 0 ? 7 : jsDay;

  if (!availableDays.includes(specDay)) {
    console.log(`[getAvailableSlots] Day ${specDay} not in available_days [${availableDays.join(',')}] for ${date}`);
    return [];
  }

  // Check max_advance_days (UTC-date approximation)
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.floor((targetDate.getTime() - todayUTC.getTime()) / 86400000);
  if (diffDays < 0 || diffDays > maxAdvanceDays) {
    console.log(`[getAvailableSlots] Date ${date} out of range: diffDays=${diffDays}, maxAdvanceDays=${maxAdvanceDays}`);
    return [];
  }

  // Generate all slots in calendar-local time
  const hours = cal.available_hours as { start: string; end: string };
  const [startH, startM] = hours.start.split(':').map(Number) as [number, number];
  const [endH, endM] = hours.end.split(':').map(Number) as [number, number];
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const rawSlots: TimeSlot[] = [];
  let cursor = startMinutes;
  while (cursor + slotDuration <= endMinutes) {
    rawSlots.push({
      start: minutesToHHMM(cursor),
      end: minutesToHHMM(cursor + slotDuration),
    });
    cursor += slotDuration + bufferMinutes;
  }

  console.log(`[getAvailableSlots] Generated ${rawSlots.length} raw slots for ${date} tz=${tz}`);

  // Fetch booked appointments for this date in the calendar's timezone
  const bookedResult = await query<{ start_time: string; end_time: string }>(
    `SELECT start_time, end_time FROM appointments
     WHERE calendar_id = $1
       AND (start_time AT TIME ZONE $3)::date = $2::date
       AND status != 'cancelled'`,
    [calendarId, date, tz]
  );

  console.log(`[getAvailableSlots] Booked appointments count: ${bookedResult.rows.length}`);

  // Convert booked UTC times to calendar-local HH:MM for overlap comparison
  const booked = bookedResult.rows.map((r) => ({
    start: timeToMinutes(toLocalHHMM(new Date(r.start_time), tz)),
    end: timeToMinutes(toLocalHHMM(new Date(r.end_time), tz)),
  }));

  // Get current local time in the calendar's timezone for "past slot" filtering
  const now = new Date();
  const todayLocalStr = toLocalDateStr(now, tz);
  const nowMinutes = timeToMinutes(toLocalHHMM(now, tz));

  console.log(`[getAvailableSlots] today in tz=${tz}: ${todayLocalStr}, now=${minutesToHHMM(nowMinutes)}`);

  const available = rawSlots.filter((slot) => {
    const slotStartMin = timeToMinutes(slot.start);
    const slotEndMin = timeToMinutes(slot.end);
    if (date === todayLocalStr && slotStartMin <= nowMinutes) return false;
    return !booked.some((b) => slotStartMin < b.end && slotEndMin > b.start);
  });

  console.log(`[getAvailableSlots] Final available slots: ${available.length}`);
  return available;
}

/**
 * Converts a wall-clock date+time in the given timezone to a UTC Date.
 * Example: localTimeToUTC('2026-03-06', '09:00', 'America/Bogota')
 *          → 2026-03-06T14:00:00.000Z  (Bogota is UTC-5, so 9AM local = 2PM UTC)
 *
 * Uses Date.UTC() as anchor to avoid server-local-timezone dependency,
 * and Intl.DateTimeFormat.formatToParts() to read the offset without
 * relying on locale-string parsing (which is ambiguous for non-ISO formats).
 */
export function localTimeToUTC(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];

  // Build a UTC anchor from the raw components (no server-tz interpretation)
  const utcAnchor = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  // Ask Intl: what does the target timezone show for this UTC instant?
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcAnchor);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0');

  // Reconstruct the "timezone representation" as a UTC Date for arithmetic
  const tzHour = get('hour') === 24 ? 0 : get('hour'); // handle midnight edge-case
  const tzAsUTC = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), tzHour, get('minute'), 0));

  // offsetMs = how far UTC is ahead of the timezone (positive for UTC-N zones)
  const offsetMs = utcAnchor.getTime() - tzAsUTC.getTime();

  // Shift the anchor by the offset: 09:00 UTC anchor + 5h offset = 14:00 UTC (= 9AM Bogota)
  return new Date(utcAnchor.getTime() + offsetMs);
}

/** Formats a UTC Date as HH:MM in the given timezone (24h).
 *  Uses the locale-string trick for maximum Node.js compatibility. */
function toLocalHHMM(date: Date, timezone: string): string {
  // Parse the date-time string as it appears in the target timezone
  const localStr = date.toLocaleString('en-US', { timeZone: timezone });
  // localStr format: "3/4/2026, 2:30:00 PM" or "3/4/2026, 14:30:00"
  const localDate = new Date(localStr);
  const h = localDate.getHours().toString().padStart(2, '0');
  const m = localDate.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Returns the current date as YYYY-MM-DD in the given timezone. */
function toLocalDateStr(date: Date, timezone: string): string {
  // 'en-CA' locale reliably gives YYYY-MM-DD format
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
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
