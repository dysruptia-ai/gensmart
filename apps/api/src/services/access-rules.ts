/**
 * Pure access rules (roles and session membership). No imports on purpose: testable on its own.
 */

export function isRoleAllowed(role: string | undefined, allowed: readonly string[]): boolean {
  return !!role && allowed.includes(role);
}

/** owner may invite admins and members; admin may invite members only; member may not invite. */
export function canInviteRole(requesterRole: string | undefined, targetRole: string): boolean {
  if (requesterRole === 'owner') return true;
  if (requesterRole === 'admin') return targetRole !== 'admin' && targetRole !== 'owner';
  return false;
}

export interface MembershipLike {
  organization_id: string;
  role: string;
  created_at?: string | Date | null;
}

function createdAtMs(m: MembershipLike): number {
  const t = m.created_at ? new Date(m.created_at).getTime() : NaN;
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/** The user's primary organization when still a member; otherwise the oldest membership; otherwise null. */
export function pickSessionMembership<T extends MembershipLike>(
  memberships: readonly T[],
  primaryOrgId: string | null | undefined
): T | null {
  if (memberships.length === 0) return null;
  const primary = primaryOrgId ? memberships.find((m) => m.organization_id === primaryOrgId) : undefined;
  if (primary) return primary;
  return [...memberships].sort((a, b) => createdAtMs(a) - createdAtMs(b))[0] ?? null;
}
