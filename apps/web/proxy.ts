import { NextRequest, NextResponse } from 'next/server';
import {
  SITE_LANG_HEADER,
  SITE_NOT_FOUND_INTERNAL,
  matchInternalPath,
  matchPublicPath,
  publicPath,
  siteSectionLanguage,
} from '@/lib/site-routes';

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

/**
 * Sigue sin cambios, pero con el idioma de la URL en `SITE_LANG_HEADER`: la 404 global
 * (fuera de los layouts) no recibe parámetros y lo lee de ahí. Se fija siempre, para que
 * no llegue un valor enviado por el cliente.
 */
function next(req: NextRequest, pathname: string): NextResponse {
  const headers = new Headers(req.headers);
  headers.set(SITE_LANG_HEADER, pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'es');
  return NextResponse.next({ request: { headers } });
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // RSS del blog en español: se sirve desde la ruta interna `/es/blog/rss.xml`
  if (pathname === '/blog/rss.xml') {
    const url = req.nextUrl.clone();
    url.pathname = '/es/blog/rss.xml';
    return NextResponse.rewrite(url);
  }

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
  // Una URL dentro de una sección del sitio que no está en el registro (`/blog/no-existe`,
  // `/en/no-existe`): 404 del sitio, con cabecera y pie en su idioma. Las redirecciones de
  // next.config corren antes que el proxy, así que una URL redirigida nunca llega aquí.
  if (!siteMatch) {
    const lang = siteSectionLanguage(pathname);
    if (lang) {
      const url = req.nextUrl.clone();
      url.pathname = `/${lang}${SITE_NOT_FOUND_INTERNAL}`;
      return NextResponse.rewrite(url, { status: 404 });
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

  if (PUBLIC_PATHS.includes(pathname)) return next(req, pathname);
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return next(req, pathname);

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/design-system')) {
    const refreshToken = req.cookies.get('refresh_token');
    if (!refreshToken) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return next(req, pathname);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
