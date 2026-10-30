-- Up Migration
-- GTM roadmap item 6: the free plan is retired in favor of a paid "solo" plan ($20/mo). This is a
-- pure rename of the stored value — PLAN_LIMITS.solo keeps the same limits free had except where the
-- roadmap explicitly changed them (see packages/shared/src/constants/index.ts).
UPDATE organizations SET plan = 'solo', updated_at = NOW() WHERE plan = 'free';

ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'solo';

-- Down Migration
ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'free';

UPDATE organizations SET plan = 'free', updated_at = NOW() WHERE plan = 'solo';
