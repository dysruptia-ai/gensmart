/**
 * Horario de atención de la Bandeja (web-45). Funciones puras, sin dependencias: las usan la API (el
 * correo de la meta, el aviso fuera de horario) y la web (la barra de la meta).
 *
 * `BusinessHours`: null = siempre abierto. Si no, una entrada por día ISO (1 = lunes … 7 = domingo),
 * con `null` = cerrado ese día. Los turnos no cruzan la medianoche (open < close el mismo día).
 */

export interface DayHours {
  open: string; // HH:MM, 24 h
  close: string; // HH:MM, 24 h
}

export type BusinessDay = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export const BUSINESS_DAYS: readonly BusinessDay[] = ['1', '2', '3', '4', '5', '6', '7'];

export type BusinessHours = Partial<Record<BusinessDay, DayHours | null>> | null;

/** El horario que propone la pestaña: L-V 8-18, sábado 9-14, domingo cerrado. */
export const DEFAULT_PROPOSED_HOURS: Record<BusinessDay, DayHours | null> = {
  '1': { open: '08:00', close: '18:00' },
  '2': { open: '08:00', close: '18:00' },
  '3': { open: '08:00', close: '18:00' },
  '4': { open: '08:00', close: '18:00' },
  '5': { open: '08:00', close: '18:00' },
  '6': { open: '09:00', close: '14:00' },
  '7': null,
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHHMM(value: unknown): value is string {
  return typeof value === 'string' && HHMM.test(value);
}

/** Minutos desde la medianoche; -1 si el formato no es HH:MM. */
export function hhmmToMinutes(value: string): number {
  const m = HHMM.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

/** Por qué un horario no vale, o null si vale. */
export function businessHoursError(hours: BusinessHours): 'format' | 'order' | null {
  if (hours === null) return null;
  for (const day of BUSINESS_DAYS) {
    const h = hours[day];
    if (h === null || h === undefined) continue;
    if (!isValidHHMM(h.open) || !isValidHHMM(h.close)) return 'format';
    if (hhmmToMinutes(h.open) >= hhmmToMinutes(h.close)) return 'order';
  }
  return null;
}

// ── zona horaria ────────────────────────────────────────────────────────────

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: BusinessDay;
}

const WEEKDAYS: Record<string, BusinessDay> = { Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6', Sun: '7' };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const parts: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts['year']),
    month: Number(parts['month']),
    day: Number(parts['day']),
    hour: Number(parts['hour']) % 24,
    minute: Number(parts['minute']),
    second: Number(parts['second']),
    weekday: WEEKDAYS[parts['weekday'] ?? 'Mon'] ?? '1',
  };
}

/** Desfase de la zona en ese instante, en ms (local − UTC). */
function offsetMs(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * El instante de una hora local (año, mes, día, minutos desde la medianoche) en esa zona. Si la hora no
 * existe (salto de primavera) devuelve la de después del salto; si existe dos veces, la primera.
 */
export function zonedTimeToInstant(year: number, month: number, day: number, minutes: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, 0, minutes);
  const first = offsetMs(new Date(guess), timeZone);
  let instant = guess - first;
  const second = offsetMs(new Date(instant), timeZone);
  if (second !== first) {
    const alt = guess - second;
    // La hora existe con el segundo desfase: úsalo. Si no existe con ninguno, nos quedamos con la de después.
    instant = offsetMs(new Date(alt), timeZone) === second ? Math.min(alt, instant) : Math.max(alt, instant);
  }
  return new Date(instant);
}

function addDays(year: number, month: number, day: number, n: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function weekdayOf(year: number, month: number, day: number): BusinessDay {
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  return String(js === 0 ? 7 : js) as BusinessDay;
}

/** El intervalo abierto de un día local, como instantes; null si ese día está cerrado. */
function dayWindow(
  hours: Exclude<BusinessHours, null>,
  timeZone: string,
  ymd: { year: number; month: number; day: number }
): { start: number; end: number } | null {
  const h = hours[weekdayOf(ymd.year, ymd.month, ymd.day)];
  if (!h) return null;
  const open = hhmmToMinutes(h.open);
  const close = hhmmToMinutes(h.close);
  if (open < 0 || close <= open) return null;
  return {
    start: zonedTimeToInstant(ymd.year, ymd.month, ymd.day, open, timeZone).getTime(),
    end: zonedTimeToInstant(ymd.year, ymd.month, ymd.day, close, timeZone).getTime(),
  };
}

// ── lo que usan la API y la web ─────────────────────────────────────────────

export function isOpenAt(hours: BusinessHours, timeZone: string, date: Date): boolean {
  if (hours === null) return true;
  const p = localParts(date, timeZone);
  const w = dayWindow(hours, timeZone, p);
  const t = date.getTime();
  return !!w && t >= w.start && t < w.end;
}

/**
 * La próxima apertura después de `date` (o `date` si ya está abierto). null si el horario es null
 * (siempre abierto) o si no abre ningún día.
 */
export function nextOpening(hours: BusinessHours, timeZone: string, date: Date): Date | null {
  if (hours === null) return null;
  const t = date.getTime();
  const p = localParts(date, timeZone);
  for (let i = 0; i <= 8; i++) {
    const w = dayWindow(hours, timeZone, addDays(p.year, p.month, p.day, i));
    if (!w) continue;
    if (t < w.start) return new Date(w.start);
    if (t < w.end) return date;
  }
  return null;
}

/** Los minutos de atención entre dos instantes (lo que cuenta para la meta). Con null, los minutos reales. */
export function businessMinutesBetween(hours: BusinessHours, timeZone: string, from: Date, to: Date): number {
  const a = from.getTime();
  const b = to.getTime();
  if (!(b > a)) return 0;
  if (hours === null) return (b - a) / 60_000;
  const p = localParts(from, timeZone);
  let total = 0;
  // Tope de un año: una espera más larga no cambia nada en la pantalla
  for (let i = 0; i < 370; i++) {
    const ymd = addDays(p.year, p.month, p.day, i);
    const dayStart = zonedTimeToInstant(ymd.year, ymd.month, ymd.day, 0, timeZone).getTime();
    if (dayStart >= b) break;
    const w = dayWindow(hours, timeZone, ymd);
    if (!w) continue;
    const s = Math.max(a, w.start);
    const e = Math.min(b, w.end);
    if (e > s) total += e - s;
  }
  return total / 60_000;
}
