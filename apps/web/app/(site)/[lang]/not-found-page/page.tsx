import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteNotFound from '@/components/site/NotFound/SiteNotFound';
import { siteT } from '@/lib/site-i18n';
import { isSiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isSiteLanguage(lang)) notFound();
  return {
    title: { absolute: siteT(lang)('site.notFound.title') },
    robots: { index: false, follow: true },
  };
}

/**
 * 404 del sitio con cabecera y pie, en el idioma de la ruta. Solo se llega por un rewrite de
 * `proxy.ts`, que responde con estado 404 (`notFound()` dentro de `[lang]` no renderiza el
 * boundary con `globalNotFound` activado en Next 16.1).
 */
export default function SiteNotFoundRoute() {
  return <SiteNotFound />;
}
