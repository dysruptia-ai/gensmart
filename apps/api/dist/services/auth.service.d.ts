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
export declare function disable2FA(userId: string, password: string): Promise<void>;
//# sourceMappingURL=auth.service.d.ts.map