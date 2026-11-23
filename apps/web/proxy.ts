import { NextRequest, NextResponse } from 'next/server';
import { matchInternalPath, matchPublicPath, publicPath } from '@/lib/site-routes';

const PUBLIC_PATHS = [
  '/',
  '/en',
  '/login',
  '/register',
  '/forgot-password',
  '/pricing',
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

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Sitio público con rutas por idioma (lib/site-routes): español en la raíz, inglés bajo /en
  const siteMatch = matchPublicPath(pathname);
  if (siteMatch?.lang === 'es') {
    const url = req.nextUrl.clone();
    url.pathname = `/es${siteMatch.route.internal}`;
    return NextResponse.rewrite(url);
  }
  // /es y /es/… no se sirven directo: 308 a la ruta pública en español (sin contenido duplicado)
  if (pathname === '/es' || pathname.startsWith('/es/')) {
    const route = matchInternalPath(pathname.slice(3));
    if (!route) return new NextResponse(null, { status: 404 });
    const url = req.nextUrl.clone();
    url.pathname = publicPath(route.id, 'es');
    return NextResponse.redirect(url, 308);
  }

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/design-system')) {
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
