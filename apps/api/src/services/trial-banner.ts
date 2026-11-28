/**
 * GenSmart trial shown to the client (GET /api/organization → trial_ends_at → dashboard trial banner).
 * Pure: no imports.
 *
 * An org that already pays with Stripe (subscription present and active/trialing) never sees the
 * trial, even if trial_ends_at kept a date (e.g. the 17-Nov trial→paid bug). Paying during the
 * GenSmart trial creates a Stripe 'trialing' subscription (first charge deferred to the trial end,
 * see billing-checkout.ts), so 'trialing' is hidden too. Only a boolean about Stripe is
 * used here; no Stripe id leaves the server.
 */
const LIVE_STRIPE_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing']);

export function visibleTrialEndsAt<T>(org: {
  trial_ends_at: T | null;
  has_stripe_subscription: boolean;
  subscription_status: string | null;
}): T | null {
  if (org.trial_ends_at === null) return null;
  if (org.has_stripe_subscription && LIVE_STRIPE_STATUSES.has(org.subscription_status ?? '')) return null;
  return org.trial_ends_at;
}
