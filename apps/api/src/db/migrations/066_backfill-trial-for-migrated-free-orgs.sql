-- Up Migration
-- Orgs that were on the retired 'free' plan got renamed to 'solo' by migration 063, but never
-- received a trial_ends_at (that logic only exists in register(), added afterwards) — they'd stay
-- on solo with full access forever, unsuspendable. Give them a fresh trial, same length as new
-- signups (platform_settings.trial_duration_days). Sub-accounts are excluded: each has its own
-- organizations row with plan hardcoded to 'solo' at creation (sub-account.service.ts), but they
-- ride on the parent org's billing and must never be independently trialed/suspended.
UPDATE organizations
SET trial_ends_at = NOW() + (
      (SELECT value FROM platform_settings WHERE key = 'trial_duration_days') || ' days'
    )::interval,
    updated_at = NOW()
WHERE plan = 'solo'
  AND trial_ends_at IS NULL
  AND is_suspended = false
  AND NOT EXISTS (
    SELECT 1 FROM sub_accounts sa WHERE sa.child_organization_id = organizations.id
  );

-- Down Migration
-- Irreversible by design: reverting a backfilled trial_ends_at back to NULL cannot be done safely
-- once time has passed (can't distinguish rows this migration touched from ones that got a real
-- trial_ends_at some other way afterward). No-op.
