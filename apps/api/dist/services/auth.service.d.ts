export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        orgId: string;
        orgName: string;
        totpEnabled: boolean;
        language: string;
        onboardingCompleted: boolean;
        onboardingStep: number;
        editorTourCompleted: boolean;
        isSuperAdmin: boolean;
    };
}
export interface TwoFactorRequired {
    requires2FA: true;
    tempToken: string;
}
export declare function register(input: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
    promoCode?: string;
}): Promise<AuthTokens>;
export declare function login(input: {
    email: string;
    password: string;
}): Promise<AuthTokens | TwoFactorRequired>;
export declare function verify2FA(input: {
    tempToken: string;
    code: string;
}): Promise<AuthTokens>;
export declare function refreshToken(currentRefreshToken: string): Promise<AuthTokens>;
export declare function logout(currentRefreshToken: string): Promise<void>;
export declare function forgotPassword(email: string): Promise<void>;
export declare function resetPassword(input: {
    token: string;
    password: string;
}): Promise<void>;
export declare function setup2FA(_userId: string): Promise<{
    secret: string;
    qrCode: string;
}>;
export declare function enable2FA(userId: string, secret: string, code: string): Promise<{
    backupCodes: string[];
}>;
/**
 * Create a brand-new Organization and either a new User (owner) or a bridge
 * membership to an existing User (identified by email), without issuing any
 * session/JWT. Callable from a non-HTTP context (e.g. an internal
 * provisioning webhook) — no req/res dependency.
 *
 * Does NOT touch the existing user's `users.organization_id`/`role` when
 * linking to an already-registered email: that column keeps acting as their
 * primary org for normal password login, exactly as before. The new
 * membership is recorded only in `user_organizations`, and access to this
 * specific org is granted via the org-access token flow below (which reads
 * the org id from the token, not from `users.organization_id`).
 */
export declare function provisionOrganization(input: {
    email: string;
    name: string;
    organizationName: string;
    plan: string;
    billingSource: string;
    externalSubscriptionId: string;
}): Promise<{
    userId: string;
    organizationId: string;
    isNewUser: boolean;
}>;
/**
 * Generate a one-time passwordless access token scoped to one specific
 * (user, organization) pair and email it. Unlike `forgotPassword`, the
 * consuming endpoint never asks for a password — it logs the user straight
 * into that organization.
 */
export declare function generateOrgAccessToken(userId: string, organizationId: string): Promise<string>;
export declare function sendOrgAccessLinkEmail(userId: string, organizationId: string, storeName: string): Promise<void>;
/**
 * Consume a passwordless org-access token and return full session tokens
 * scoped to the organization the link was generated for — which may differ
 * from the user's `users.organization_id` (their other, primary org). Reads
 * the effective role from `user_organizations` for that specific org.
 */
export declare function consumeOrgAccessToken(token: string): Promise<AuthTokens>;
/**
 * Resends org access via a stale org_access_tokens row (used or expired) —
 * the row itself is never deleted on consume, only marked `used`, so its id
 * still tells us which organization the merchant was trying to reach. This
 * is the only path back in for a passwordless account: there's no password
 * to reset, and a generic "forgot password" would land on the user's
 * primary org anyway (same class of bug fixed in refreshToken()), not the
 * Tiendanube org the stale link pointed at.
 *
 * Deliberately silent on every "nothing to do" branch (unknown token id,
 * rate-limited, user no longer a member) — the caller always returns the
 * same generic success message regardless, so this endpoint can't be used
 * to probe whether a given token/org exists.
 */
export declare function resendOrgAccessEmail(originalToken: string): Promise<void>;
export declare function disable2FA(userId: string, password: string): Promise<void>;
//# sourceMappingURL=auth.service.d.ts.map