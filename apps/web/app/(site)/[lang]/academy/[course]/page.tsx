import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import AcademyCoursePage from '@/components/site/academy/AcademyCoursePage';
import { courseByInternalSlug, courseJsonLd, courseMetadata } from '@/components/site/academy/academyContent';
import type { AcademyCourseData } from '@/components/site/academy/academyData';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { ACADEMY_ROUTES } from '@/lib/academy-routes';
import { siteT } from '@/lib/site-i18n';
import { SITE_LANGUAGES, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string; course: string }>;
}

/** Slug desconocido: 404. La ruta interna usa el slug en inglés (`proxy.ts` reescribe el español). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.flatMap((lang) => ACADEMY_ROUTES.map((c) => ({ lang, course: c.slug.en })));
}

async function resolve(params: PageProps['params']): Promise<{ lang: SiteLanguage; course: AcademyCourseData }> {
  const { lang, course: slug } = await params;
  const course = courseByInternalSlug(slug);
  if (!isSiteLanguage(lang) || !course) notFound();
  return { lang, course };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, course } = await resolve(params);
  return courseMetadata(course, lang, siteT(lang));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Curso de Academy: `/academia/<slug-es>` y `/en/academy/<slug-en>`. */
export default async function AcademyCourseRoute({ params }: PageProps) {
  const { lang, course } = await resolve(params);
  return (
    <SolutionShell jsonLd={courseJsonLd(course, lang, siteT(lang))}>
      <AcademyCoursePage course={course} lang={lang} />
    </SolutionShell>
  );
}
