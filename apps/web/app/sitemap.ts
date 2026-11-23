import { MetadataRoute } from 'next';
import { SITE_LANGUAGES, SITE_ROUTES, absoluteUrl, alternates } from '@/lib/site-routes';

const BASE_URL = 'https://www.gensmart.co';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/blog`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];

  // Blog posts — ALL 6 posts (3 EN + 3 ES)
  const blogSlugs = [
    'how-to-deploy-whatsapp-ai-agent',
    'ai-lead-scoring-explained',
    'n8n-vs-gensmart-comparison',
    'como-desplegar-agente-whatsapp-ia',
    'lead-scoring-ia-crm',
    'gensmart-vs-n8n-automatizacion',
  ];

  const blogRoutes: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

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

  // Páginas con rutas por idioma: una entrada por idioma, con sus alternas (es, en, x-default)
  const siteRoutes: MetadataRoute.Sitemap = Object.values(SITE_ROUTES).flatMap((route) =>
    SITE_LANGUAGES.map((lang) => ({
      url: absoluteUrl(route.paths[lang]),
      changeFrequency: 'weekly' as const,
      priority: route.id === 'home' ? 1.0 : route.id === 'pricing' ? 0.9 : 0.8,
      alternates: { languages: alternates(route.id) },
    }))
  );

  return [...siteRoutes, ...staticRoutes, ...blogRoutes, ...legalRoutes];
}
