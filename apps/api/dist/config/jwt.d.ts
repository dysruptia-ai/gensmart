export interface AccessTokenPayload {
    userId: string;
    orgId: string;
    role: string;
    email: string;
    isSuperAdmin?: boolean;
}
export interface RefreshTokenPayload {
    userId: string;
    orgId: string;
    tokenId: string;
}
export interface TempTokenPayload {
    userId: string;
    purpose: '2fa';
}
export declare function generateAccessToken(payload: AccessTokenPayload): string;
export declare function generateRefreshToken(payload: RefreshTokenPayload): string;
export declare function generateTempToken(payload: TempTokenPayload): string;
export declare function verifyAccessToken(token: string): AccessTokenPayload;
export declare function verifyRefreshToken(token: string): RefreshTokenPayload;
export declare function verifyTempToken(token: string): TempTokenPayload;
//# sourceMappingURL=jwt.d.ts.map