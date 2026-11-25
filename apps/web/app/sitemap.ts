import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { blogPostRouteId } from '@/lib/blog-routes';
import { DOCS } from '@/components/site/docs/docsData';
import { docRouteId } from '@/lib/docs-routes';
import { getLegalDoc } from '@/lib/legal';
import { LEGAL_ROUTES } from '@/lib/legal-routes';
import { SITE_LANGUAGES, SITE_ROUTES, absoluteUrl, alternates, type SiteLanguage, type SiteRouteId } from '@/lib/site-routes';

const LEGAL_ROUTE_IDS = new Set<SiteRouteId>(LEGAL_ROUTES.map((l) => l.routeId));

export default function sitemap(): MetadataRoute.Sitemap {
  // Artículos del blog: `lastModified` = `updated` del Markdown (fecha real del contenido)
  const postUpdated = new Map<SiteRouteId, string>(getAllPosts('es').map((p) => [blogPostRouteId(p.id), p.updated]));
  // Guías de docs: `updated` de la guía (el mismo que va en `dateModified`)
  const docUpdated = new Map<SiteRouteId, string>(DOCS.map((d) => [docRouteId(d.id), d.updated]));

  /** Fecha real del contenido, si la página la tiene (legales: `lastUpdated` del Markdown de ese idioma). */
  function lastModified(id: SiteRouteId, lang: SiteLanguage): string | undefined {
    const legal = LEGAL_ROUTES.find((l) => l.routeId === id);
    if (legal) return getLegalDoc(legal.id, lang).lastUpdated;
    return postUpdated.get(id) ?? docUpdated.get(id);
  }

  // Páginas con rutas por idioma: una entrada por idioma, con sus alternas (es, en, x-default)
  const siteRoutes: MetadataRoute.Sitemap = Object.values(SITE_ROUTES)
    .filter((route) => !route.noindex)
    .flatMap((route) =>
      SITE_LANGUAGES.map((lang) => {
        const modified = lastModified(route.id, lang);
        return {
          url: absoluteUrl(route.paths[lang]),
          ...(modified ? { lastModified: modified } : {}),
          changeFrequency: LEGAL_ROUTE_IDS.has(route.id) ? ('yearly' as const) : ('weekly' as const),
          priority: route.id === 'home' ? 1.0 : route.id === 'pricing' || route.id === 'product' ? 0.9 : LEGAL_ROUTE_IDS.has(route.id) ? 0.3 : 0.8,
          alternates: { languages: alternates(route.id) },
        };
      })
    );

  return siteRoutes;
}
