import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminShell from './AdminShell';

// Forces this segment onto the Node runtime (not edge) so it can call the backend
// and gate the panel before any HTML or JS is sent to the browser.
export const runtime = 'nodejs';

interface SessionCheckResponse {
  user?: { isSuperAdmin?: boolean };
}

async function isSuperAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token');
  if (!refreshToken) return false;

  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? process.env['API_URL'] ?? 'http://localhost:4000';
  try {
    // Read-only check — does not rotate the refresh token, since this server-to-server call
    // can't propagate a new Set-Cookie back to the browser (see verifySession() on the API).
    const res = await fetch(`${apiUrl}/api/auth/session-check`, {
      method: 'GET',
      headers: { Cookie: `refresh_token=${refreshToken.value}` },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as SessionCheckResponse;
    return data.user?.isSuperAdmin === true;
  } catch {
    return false;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has('refresh_token');
  if (!hasSession) {
    redirect('/login');
  }

  const admin = await isSuperAdmin();
  if (!admin) {
    redirect('/dashboard');
  }

  return <AdminShell>{children}</AdminShell>;
}
