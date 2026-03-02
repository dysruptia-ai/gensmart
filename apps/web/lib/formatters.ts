/**
 * Locale-aware date, time, and number formatters.
 * All functions accept a locale string ('en' | 'es') and use Intl APIs.
 */

export function formatDate(date: string | Date, locale: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date, locale: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(date: string | Date, locale: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US').format(num);
}

export function formatCurrency(amount: number, locale: string, currency = 'USD'): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100); // Stripe amounts are in cents
}

export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/**
 * Formats a date relative to now (e.g. "5 minutes ago" / "hace 5 minutos").
 */
export function formatRelativeTime(date: string | Date, locale: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';

  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale === 'es' ? 'es' : 'en', { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');

  // Fall back to absolute date for older items
  return formatDate(d, locale);
}
