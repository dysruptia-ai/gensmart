import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FACEBOOK_APP_ID: process.env['NEXT_PUBLIC_FACEBOOK_APP_ID'] ?? '',
    NEXT_PUBLIC_FACEBOOK_CONFIG_ID: process.env['NEXT_PUBLIC_FACEBOOK_CONFIG_ID'] ?? '',
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
