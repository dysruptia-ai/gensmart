/**
 * Manual plan assignment from the super admin panel (PUT /api/admin/organizations/:id/plan).
 *
 * Every admin plan change is a definitive plan: in ONE statement the plan is set, the trial is
 * cleared (trial_ends_at = NULL, so expireTrials() in index.ts never suspends the org later) and
 * the org is reactivated (is_suspended = false, the only access gate: suspension middleware and
 * message worker). subscription_status is left untouched: it only drives labels, never access.
 *
 * The same statement writes an audit row in billing_events (stripe_event_id NULL, no migration).
 */
import { isUuid } from './widget-input';

export const ADMIN_PLANS = ['solo', 'starter', 'pro', 'enterprise'] as const;
export type AdminPlan = (typeof ADMIN_PLANS)[number];

/**
 * prev locks the row (FOR UPDATE) and keeps the values before the change; upd applies the definitive
 * plan; audit records it. Data-modifying CTEs run atomically in one statement: all or nothing.
 * $1 plan, $2 org id, $3 super admin user id.
 */
export const SQL_ASSIGN_DEFINITIVE_PLAN = `WITH prev AS (
       SELECT id, plan, is_suspended, trial_ends_at
         FROM organizations
        WHERE id = $2
        FOR UPDATE
     ),
     upd AS (
       UPDATE organizations o
          SET plan = $1, trial_ends_at = NULL, is_suspended = false, updated_at = NOW()
         FROM prev
        WHERE o.id = prev.id
       RETURNING o.id, o.plan, o.stripe_subscription_id, o.subscription_status,
                 prev.plan AS previous_plan, prev.is_suspended AS was_suspended,
                 (prev.trial_ends_at IS NOT NULL) AS had_trial
     ),
     audit AS (
       INSERT INTO billing_events (organization_id, stripe_event_id, event_type, amount, metadata, created_at)
       SELECT id, NULL, 'admin_plan_change', NULL,
              jsonb_build_object(
                'previous_plan', previous_plan,
                'new_plan', plan,
                'admin_user_id', $3::text,
                'was_suspended', was_suspended,
                'had_trial', had_trial
              ),
              NOW()
         FROM upd
       RETURNING id
     )
SELECT upd.*, (SELECT id FROM audit) AS audit_event_id FROM upd`;

export interface AssignPlanRow {
  id: string;
  plan: string;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  previous_plan: string;
  was_suspended: boolean;
  had_trial: boolean;
  audit_event_id: string | null;
}

export interface AdminPlanDeps {
  /** Runs SQL_ASSIGN_DEFINITIVE_PLAN; null when the org does not exist. */
  assign: (plan: AdminPlan, orgId: string, adminUserId: string) => Promise<AssignPlanRow | null>;
  /** org:reactivated to room org:<id>, like stripe.service updateOrgSubscription. Must not throw. */
  emitReactivated: (orgId: string) => void;
  log: { info: (msg: string) => void };
}

export type AssignPlanOutcome =
  | { kind: 'not_found' }
  | {
      kind: 'ok';
      plan: string;
      trialCleared: true;
      reactivated: boolean;
      warning?: 'STRIPE_SUBSCRIPTION_ACTIVE';
    };

const LIVE_STRIPE_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing']);

export async function assignDefinitivePlan(
  input: { orgId: string; plan: AdminPlan; adminUserId: string },
  deps: AdminPlanDeps
): Promise<AssignPlanOutcome> {
  // Not a UUID → it cannot exist; never reaches the database.
  if (!isUuid(input.orgId)) return { kind: 'not_found' };

  const row = await deps.assign(input.plan, input.orgId, input.adminUserId);
  if (!row) return { kind: 'not_found' };

  const reactivated = row.was_suspended === true;
  if (reactivated) deps.emitReactivated(row.id);

  // Ids and plan names only: no personal data.
  deps.log.info(
    `[admin] plan change org ${row.id}: ${row.previous_plan} -> ${row.plan} by admin ${input.adminUserId}` +
      ` (trial cleared: ${row.had_trial}, reactivated: ${reactivated}, audit ${row.audit_event_id ?? 'none'})`
  );

  // A Stripe webhook (renewal, plan change in the portal) can set the plan again.
  const stripeLive =
    row.stripe_subscription_id !== null && LIVE_STRIPE_STATUSES.has(row.subscription_status ?? '');

  return {
    kind: 'ok',
    plan: row.plan,
    trialCleared: true,
    reactivated,
    ...(stripeLive ? { warning: 'STRIPE_SUBSCRIPTION_ACTIVE' as const } : {}),
  };
}
