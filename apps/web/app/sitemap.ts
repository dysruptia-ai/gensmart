import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { blogPostRouteId } from '@/lib/blog-routes';
import { SITE_LANGUAGES, SITE_ROUTES, absoluteUrl, alternates, type SiteRouteId } from '@/lib/site-routes';

const BASE_URL = 'https://www.gensmart.co';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  const legalRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/legal/privacy-policy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms-of-service`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/cookie-policy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Artículos del blog: `lastModified` = `updated` del Markdown (fecha real del contenido)
  const postUpdated = new Map<SiteRouteId, string>(getAllPosts('es').map((p) => [blogPostRouteId(p.id), p.updated]));

  // Páginas con rutas por idioma: una entrada por idioma, con sus alternas (es, en, x-default)
  const siteRoutes: MetadataRoute.Sitemap = Object.values(SITE_ROUTES).flatMap((route) =>
    SITE_LANGUAGES.map((lang) => ({
      url: absoluteUrl(route.paths[lang]),
      ...(postUpdated.has(route.id) ? { lastModified: postUpdated.get(route.id) } : {}),
      changeFrequency: 'weekly' as const,
      priority: route.id === 'home' ? 1.0 : route.id === 'pricing' || route.id === 'product' ? 0.9 : 0.8,
      alternates: { languages: alternates(route.id) },
    }))
  );

  return [...siteRoutes, ...staticRoutes, ...legalRoutes];
}
