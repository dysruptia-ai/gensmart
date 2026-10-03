/**
 * Role a user really has in the organization of the request, from the database (never from the token).
 *
 * - memberRole: role in user_organizations of THAT organization.
 * - parentRole: role of the user in the parent organization, when the organization is a sub-account
 *   (sub-account sessions have no membership row of their own).
 *
 * The parent role only counts for owners and admins, the same roles allowed to switch to a sub-account.
 */
export function resolveEffectiveRole(memberRole: string | null, parentRole: string | null): string | null {
  if (memberRole) return memberRole;
  if (parentRole === 'owner' || parentRole === 'admin') return parentRole;
  return null;
}
