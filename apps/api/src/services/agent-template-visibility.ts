/**
 * Beta gating of agent templates (agent_templates.allowed_org_ids, migration 072). Same contract as
 * mcp_provider_profiles.allowed_org_ids: NULL = every organization; a JSON array = only the
 * organization ids it contains ('[]' = nobody). Anything else (malformed) hides the template.
 * No imports: shared by agent.service.ts and the tests.
 */

/** SQL condition; $1 is the organization id. */
export const TEMPLATE_VISIBLE_TO_ORG_SQL =
  `(allowed_org_ids IS NULL OR (jsonb_typeof(allowed_org_ids) = 'array' AND allowed_org_ids ? $1::text))`;

/** Pure mirror of TEMPLATE_VISIBLE_TO_ORG_SQL. */
export function isTemplateVisibleToOrg(allowedOrgIds: unknown, orgId: string): boolean {
  if (allowedOrgIds === null || allowedOrgIds === undefined) return true;
  return Array.isArray(allowedOrgIds) && allowedOrgIds.some((id) => id === orgId);
}
