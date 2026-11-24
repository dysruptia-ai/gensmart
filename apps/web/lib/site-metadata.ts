/**
 * Metadatos de las páginas del sitio público con rutas por idioma:
 * canonical, `hreflang` (es, en y x-default), Open Graph y Twitter por idioma.
 */
import type { Metadata } from 'next';
import {
  absoluteUrl,
  alternates,
  otherLanguage,
  publicPath,
  type SiteLanguage,
  type SiteRouteId,
} from './site-routes';

export const OG_LOCALE: Record<SiteLanguage, string> = { es: 'es_LA', en: 'en_US' };

interface PageMeta {
  title: string;
  description: string;
  ogAlt: string;
  /** Imagen OG propia (artículos del blog). Sin ella, el póster del hero del idioma. */
  ogImage?: { url: string; width: number; height: number };
}

export function sitePageMetadata(id: SiteRouteId, lang: SiteLanguage, meta: PageMeta): Metadata {
  const { title, description, ogAlt } = meta;
  const url = absoluteUrl(publicPath(id, lang));
  const image = meta.ogImage ?? { url: `/site/img/hero-motion-poster-${lang}.webp` };
  const ogImage = image.url;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: alternates(id) },
    openGraph: {
      type: 'website',
      siteName: 'GenSmart',
      title,
      description,
      url,
      locale: OG_LOCALE[lang],
      alternateLocale: [OG_LOCALE[otherLanguage(lang)]],
      images: [{ ...image, alt: ogAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}
