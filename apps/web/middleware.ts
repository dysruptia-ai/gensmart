import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/pricing',
  '/design-system',
];

const PUBLIC_PREFIXES = [
  '/blog',
  '/reset-password',
  '/widget',
  '/docs',
  '/_next',
  '/api',
  '/favicon',
];

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Check if path is public
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();

  // Protected: only /dashboard/* requires auth check
  if (pathname.startsWith('/dashboard')) {
    const refreshToken = req.cookies.get('refresh_token');
    if (!refreshToken) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
