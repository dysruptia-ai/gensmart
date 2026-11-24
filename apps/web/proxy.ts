import { NextRequest, NextResponse } from 'next/server';
import { matchInternalPath, matchPublicPath, publicPath } from '@/lib/site-routes';

const PUBLIC_PATHS = [
  '/',
  '/en',
  '/login',
  '/register',
  '/forgot-password',
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
  // Variantes en mayúsculas (`/soluciones/equipos/VENTAS`): 308 a la ruta canónica.
  // La barra final ya la redirige Next.js antes de llegar aquí.
  if (!siteMatch && pathname !== pathname.toLowerCase()) {
    const lower = matchPublicPath(pathname.toLowerCase());
    if (lower) {
      const url = req.nextUrl.clone();
      url.pathname = lower.route.paths[lower.lang];
      return NextResponse.redirect(url, 308);
    }
  }
  if (siteMatch) {
    // Se reescribe a `/{idioma}{interna}` si la ruta pública es otra: siempre en español
    // (`/precios`) y en inglés cuando el segmento cambia (`/en/product/ai-agents`)
    const internal = `/${siteMatch.lang}${siteMatch.route.internal}`;
    const publicNormalized = siteMatch.route.paths[siteMatch.lang];
    if (siteMatch.lang === 'es' || internal !== publicNormalized) {
      const url = req.nextUrl.clone();
      url.pathname = internal;
      return NextResponse.rewrite(url);
    }
  }
  // La ruta interna en inglés no se sirve directo si la pública es otra: 308 a la pública
  if (!siteMatch && pathname.startsWith('/en/')) {
    const route = matchInternalPath(pathname.slice(3));
    if (route && route.paths.en !== `/en${route.internal}`) {
      const url = req.nextUrl.clone();
      url.pathname = publicPath(route.id, 'en');
      return NextResponse.redirect(url, 308);
    }
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
