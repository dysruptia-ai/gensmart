export interface OrgMember {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url: string | null;
    created_at: string;
}
export interface OrganizationData {
    id: string;
    name: string;
    slug: string;
    plan: string;
    subscription_status: string;
    settings: Record<string, unknown>;
    created_at: string;
    member_count: number;
    trial_ends_at: string | null;
}
export declare function getOrganization(orgId: string): Promise<OrganizationData>;
export declare function updateOrganization(orgId: string, data: {
    name?: string;
    settings?: Record<string, unknown>;
}): Promise<OrganizationData>;
export declare function getMembers(orgId: string): Promise<OrgMember[]>;
export declare function inviteMember(orgId: string, inviterId: string, data: {
    email: string;
    role: string;
}): Promise<void>;
export declare function updateMemberRole(orgId: string, requesterId: string, targetUserId: string, newRole: string): Promise<void>;
export declare function removeMember(orgId: string, requesterId: string, targetUserId: string): Promise<void>;
//# sourceMappingURL=organization.service.d.ts.map