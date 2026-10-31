import type { NextConfig } from "next";

// Everything here except /widget/* — that page is embedded in customer sites via
// iframe and must stay embeddable cross-origin, so it gets no frame-ancestors/X-Frame-Options.
const BASE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.gensmart.co wss://api.gensmart.co https://challenges.cloudflare.com https://connect.facebook.net",
  "frame-src https://challenges.cloudflare.com https://www.facebook.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const WIDGET_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://api.gensmart.co wss://api.gensmart.co",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
