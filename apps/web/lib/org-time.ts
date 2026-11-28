/**
 * Bandeja (web-45b): una hora en la zona de la organización. Si quien mira está en otra zona, la hora
 * lleva la zona al final ("9:00 AM (UTC)", "9:00 a. m. (hora de Bogotá)"); si coinciden, nada extra.
 * Las burbujas del hilo no lo usan (van en la hora del navegador).
 */

export interface OrgTimeOptions {
  /** La zona del navegador (por defecto, la de Intl). Solo para los tests. */
  browserTimeZone?: string;
  /** Arma el sufijo con el nombre de la zona (viene de i18n: "({zone} time)", "(hora de {zone})"). */
  zoneLabel: (zone: string) => string;
}

function locale(language: string): string {
  return language === 'es' ? 'es-CO' : 'en-US';
}

/** "Bogotá"-style: la ciudad de la zona IANA ("America/Bogota" → "Bogota"); UTC queda "UTC". */
export function zoneName(timeZone: string): string {
  if (/^(Etc\/)?(UTC|GMT|Universal|Zulu)$/i.test(timeZone)) return 'UTC';
  const city = timeZone.split('/').pop() ?? timeZone;
  return city.replace(/_/g, ' ');
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** Misma hora en las dos zonas en este instante (p. ej. "America/Bogota" y "America/Lima"). */
function sameOffset(a: string, b: string, at: Date): boolean {
  if (a === b) return true;
  const f = (tz: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(at);
  try {
    return f(a) === f(b);
  } catch {
    return false;
  }
}

export function formatOrgTime(date: Date, orgTimeZone: string | undefined, language: string, opts: OrgTimeOptions): string {
  const time = new Intl.DateTimeFormat(locale(language), {
    hour: 'numeric',
    minute: '2-digit',
    ...(orgTimeZone ? { timeZone: orgTimeZone } : {}),
  }).format(date);
  if (!orgTimeZone) return time;
  const viewer = opts.browserTimeZone ?? browserTimeZone();
  if (sameOffset(orgTimeZone, viewer, date)) return time;
  return `${time} ${opts.zoneLabel(zoneName(orgTimeZone))}`;
}
