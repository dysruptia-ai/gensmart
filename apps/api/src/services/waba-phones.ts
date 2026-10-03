import crypto from 'crypto';

/** Pure helpers for the WhatsApp connection flows (no imports from the app). */

export function phoneBelongsToWaba(phoneIds: readonly string[], phoneNumberId: string): boolean {
  const wanted = String(phoneNumberId).trim();
  if (!wanted) return false;
  return phoneIds.some((id) => String(id).trim() === wanted);
}

export interface PhonePage {
  ids: string[];
  /** Cursor for the next page, or null when there are no more pages. */
  next: string | null;
}

export const MAX_PHONE_PAGES = 5;

/**
 * Looks for a phone number across the pages of a WABA's phone list, stopping as soon as it is
 * found. A page that fails (loader returns null or throws) or running out of pages means "not found".
 */
export async function findPhoneInPages(
  loadPage: (after: string | null) => Promise<PhonePage | null>,
  phoneNumberId: string,
  maxPages: number = MAX_PHONE_PAGES
): Promise<boolean> {
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    let result: PhonePage | null;
    try {
      result = await loadPage(after);
    } catch {
      return false;
    }
    if (!result) return false;
    if (phoneBelongsToWaba(result.ids, phoneNumberId)) return true;
    if (!result.next) return false;
    after = result.next;
  }
  return false;
}

/** Constant-time string comparison; different lengths never match. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Tokens allowed to query a WABA: the platform token only for WABAs that came from the user's own
 * token. WABAs stored earlier (unverified) can only be queried with the customer's token.
 */
export function tokensForWaba(
  wabaId: string,
  userValidatedWabaIds: ReadonlySet<string>,
  customerToken: string,
  platformToken: string
): string[] {
  return userValidatedWabaIds.has(wabaId) ? [customerToken, platformToken] : [customerToken];
}
