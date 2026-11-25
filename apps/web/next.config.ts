import type { NextConfig } from "next";

/**
 * Origen de la API para `connect-src`. En producción es api.gensmart.co (escrito abajo).
 * En desarrollo se agrega el de NEXT_PUBLIC_API_URL (por ejemplo http://localhost:4000)
 * y su WebSocket; si no, la CSP bloquea la API local y el dashboard no carga.
 */
const DEV_API_SOURCES: string = (() => {
  if (process.env.NODE_ENV === 'production') return '';
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return '';
  try {
    const { origin, protocol, host } = new URL(raw);
    return ` ${origin} ${protocol === 'https:' ? 'wss' : 'ws'}://${host}`;
  } catch {
    return '';
  }
})();

// Everything here except /widget/* — that page is embedded in customer sites via
// iframe and must stay embeddable cross-origin, so it gets no frame-ancestors/X-Frame-Options.
const BASE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://api.gensmart.co wss://api.gensmart.co https://challenges.cloudflare.com https://connect.facebook.net${DEV_API_SOURCES}`,
  // 'self': el widget del sitio (public/widget.js) abre /widget/:agentId en un iframe del mismo origen
  // youtube-nocookie: el video de la base de conocimiento (solo se carga al hacer clic)
  "frame-src 'self' https://challenges.cloudflare.com https://www.facebook.com https://www.youtube-nocookie.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const WIDGET_CSP = [
  "default-src 'self'",
  // Cloudflare Turnstile (per-session human check before web Dropi orders): script, iframe and calls
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  `connect-src 'self' https://api.gensmart.co wss://api.gensmart.co https://challenges.cloudflare.com${DEV_API_SOURCES}`,
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

/** URLs del blog viejo (content/blog/*.md hasta web-32) y su destino. */
const OLD_BLOG_REDIRECTS: ReadonlyArray<readonly [string, string]> = [
  ['/blog/ai-lead-scoring-explained', '/en/blog/ai-lead-scoring-explained'],
  ['/blog/lead-scoring-ia-crm', '/blog/puntaje-de-leads-con-ia-explicado'],
  ['/blog/how-to-deploy-whatsapp-ai-agent', '/en/blog/how-to-deploy-whatsapp-ai-agent'],
  ['/blog/como-desplegar-agente-whatsapp-ia', '/blog/como-desplegar-un-agente-de-ia-en-whatsapp'],
  ['/blog/connect-whatsapp-one-click', '/en/blog/connect-whatsapp-one-click'],
  ['/blog/conecta-whatsapp-un-click', '/blog/conectar-whatsapp-en-dos-clics'],
  ['/blog/n8n-vs-gensmart-comparison', '/en/blog/n8n-vs-gensmart-comparison'],
  ['/blog/gensmart-vs-n8n-automatizacion', '/blog/n8n-vs-gensmart-comparativa'],
  // No hay artículo de Mastershop: la guía de la base de conocimiento cubre la conexión de tiendas
  ['/blog/como-configurar-agente-mastershop-dropshipping', '/docs/conectar-tu-tienda'],
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Hay dos layouts raíz ((platform) y (site)/[lang]): las URL sin ruta usan app/global-not-found.tsx
  experimental: {
    globalNotFound: true,
  },
  async redirects() {
    return [
      // Precios vive en /precios (es) y /en/pricing (en). La URL vieja era inglesa: va a /en/pricing.
      // Next conserva el query string (/pricing?plan=pro → /en/pricing?plan=pro).
      { source: '/pricing', destination: '/en/pricing', permanent: true },
      // Contacto vive en /contacto (es) y /en/contact (en); /contact?tipo=… conserva el query
      { source: '/contact', destination: '/en/contact', permanent: true },
      // Soluciones: los niveles intermedios no tienen página propia, van al índice de su idioma
      { source: '/soluciones/equipos', destination: '/soluciones', permanent: true },
      { source: '/soluciones/industrias', destination: '/soluciones', permanent: true },
      { source: '/en/solutions/teams', destination: '/en/solutions', permanent: true },
      { source: '/en/solutions/industries', destination: '/en/solutions', permanent: true },
      // El programa de referidos se mudó a Partners (design/web: referidos.html solo decía "se mudó")
      { source: '/referidos', destination: '/partners', permanent: true },
      { source: '/en/referrals', destination: '/en/partners', permanent: true },
      // La guía vieja de WhatsApp (en inglés) se reemplazó por la de la base de conocimiento
      // 301 (no 308): pedido explícito para la URL indexada
      { source: '/docs/whatsapp-setup', destination: '/en/docs/connect-whatsapp', statusCode: 301 },
      // Blog viejo (web-32): sus 9 URLs estaban indexadas. 301 a su equivalente nuevo; los artículos
      // en inglés vivían en /blog/<slug> y ahora van bajo /en/blog
      ...OLD_BLOG_REDIRECTS.map(([source, destination]) => ({ source, destination, statusCode: 301 as const })),
      // Acerca de y legales (web-34): las URL viejas solo tenían contenido en inglés, van a /en/…
      // (/legal/privacy-policy está registrada en Meta y quizá en Google: actualizarla tras el despliegue)
      { source: '/about', destination: '/en/about', statusCode: 301 },
      { source: '/legal/privacy-policy', destination: '/en/legal/privacy-policy', statusCode: 301 },
      { source: '/legal/terms-of-service', destination: '/en/legal/terms-of-service', statusCode: 301 },
      { source: '/legal/cookie-policy', destination: '/en/legal/cookie-policy', statusCode: 301 },
      // `/legal` y `/en/legal` no tienen página propia: a Términos de su idioma
      { source: '/legal', destination: '/legal/terminos-del-servicio', permanent: true },
      { source: '/en/legal', destination: '/en/legal/terms-of-service', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/widget/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: WIDGET_CSP },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/:path((?!widget).*)',
        headers: [
          { key: 'Content-Security-Policy', value: BASE_CSP },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_FACEBOOK_APP_ID: process.env['NEXT_PUBLIC_FACEBOOK_APP_ID'] ?? '',
    NEXT_PUBLIC_FACEBOOK_CONFIG_ID: process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID'] ?? '',
    NEXT_PUBLIC_FACEBOOK_CONFIG_ID_MESSENGER: process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID_MESSENGER'] ?? '',
    NEXT_PUBLIC_FACEBOOK_CONFIG_ID_INSTAGRAM: process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID_INSTAGRAM'] ?? '',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'] ?? '',
  },
  async rewrites() {
    // In development, proxy /api/* to the Express backend
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:4000/api/:path*',
        },
        {
          source: '/uploads/:path*',
          destination: 'http://localhost:4000/uploads/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
