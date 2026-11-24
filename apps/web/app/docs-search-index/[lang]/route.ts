import { docsSearchIndex } from '@/components/site/docs/docsContent';
import { SITE_LANGUAGES, isSiteLanguage } from '@/lib/site-routes';

/**
 * Índice del buscador de la base de conocimiento, por idioma (título, resumen, grupo y `h2`
 * de cada guía), generado desde `docsData.ts` en el build. El diálogo lo pide al abrirse.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.map((lang) => ({ lang }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }): Promise<Response> {
  const { lang } = await params;
  if (!isSiteLanguage(lang)) return new Response(null, { status: 404 });
  return Response.json(docsSearchIndex(lang), {
    headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=3600' },
  });
}
