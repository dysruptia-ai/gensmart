import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { blogPostRouteId } from '@/lib/blog-routes';
import { LEGAL_ROUTES } from '@/lib/legal-routes';
import { SITE_LANGUAGES, SITE_ROUTES, absoluteUrl, alternates, type SiteRouteId } from '@/lib/site-routes';

const LEGAL_ROUTE_IDS = new Set<SiteRouteId>(LEGAL_ROUTES.map((l) => l.routeId));

export default function sitemap(): MetadataRoute.Sitemap {
  // Artículos del blog: `lastModified` = `updated` del Markdown (fecha real del contenido)
  const postUpdated = new Map<SiteRouteId, string>(getAllPosts('es').map((p) => [blogPostRouteId(p.id), p.updated]));

  // Páginas con rutas por idioma: una entrada por idioma, con sus alternas (es, en, x-default)
  const siteRoutes: MetadataRoute.Sitemap = Object.values(SITE_ROUTES)
    .filter((route) => !route.noindex)
    .flatMap((route) =>
    SITE_LANGUAGES.map((lang) => ({
      url: absoluteUrl(route.paths[lang]),
      ...(postUpdated.has(route.id) ? { lastModified: postUpdated.get(route.id) } : {}),
      changeFrequency: LEGAL_ROUTE_IDS.has(route.id) ? ('yearly' as const) : ('weekly' as const),
      priority: route.id === 'home' ? 1.0 : route.id === 'pricing' || route.id === 'product' ? 0.9 : LEGAL_ROUTE_IDS.has(route.id) ? 0.3 : 0.8,
      alternates: { languages: alternates(route.id) },
    }))
  );

  return siteRoutes;
}
