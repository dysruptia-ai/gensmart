import jwt from 'jsonwebtoken';
import { env } from './env';

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

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function generateTempToken(payload: TempTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload & { purpose?: unknown };
  // Temporary tokens (e.g. the 2FA step) share the signing secret: they must never act as a session.
  if (typeof payload === 'object' && payload !== null && 'purpose' in payload) {
    throw new Error('Invalid token purpose');
  }
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function verifyTempToken(token: string): TempTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TempTokenPayload;
  if (payload.purpose !== '2fa') {
    throw new Error('Invalid token purpose');
  }
  return payload;
}
