import crypto from 'crypto';

/**
 * Limits for the book_appointment tool (it can send mail to an address the end customer typed).
 * Only decisions and key names live here; the Redis calls stay in the worker.
 */
export const BOOKING_LIMITS = {
  perConversation: { max: 3, windowSeconds: 3600 },
  perCalendar: { max: 30, windowSeconds: 3600 },
  confirmationEmailPerAddress: { max: 3, windowSeconds: 86400 },
} as const;

/** `count` is the value AFTER the increment: the (max + 1)-th attempt is the first one refused. */
export function isOverLimit(count: number, max: number): boolean {
  return count > max;
}

export function bookingConversationKey(conversationId: string): string {
  return `booking:rate:conv:${conversationId}`;
}

export function bookingCalendarKey(calendarId: string): string {
  return `booking:rate:cal:${calendarId}`;
}

/** The address is hashed (lowercase, trimmed): it never appears in clear text in Redis. */
export function confirmationEmailKey(email: string): string {
  const hash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  return `booking:rate:email:${hash}`;
}
