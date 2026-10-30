-- Up Migration
-- `is_suspended` is a dedicated app-level flag, kept separate from `subscription_status` because that
-- column is a pure passthrough of Stripe's own subscription status strings (active/past_due/trialing/
-- canceled/etc. — see stripe.service.ts) and is not an enum GenSmart controls. Suspension (trial expiry,
-- subscription cancellation) blocks message processing and dashboard mutations without touching `plan`,
-- so a suspended org still knows what it was paying for when it reactivates.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- Down Migration
ALTER TABLE organizations DROP COLUMN IF EXISTS is_suspended;
