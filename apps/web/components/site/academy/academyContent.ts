/**
 * Lógica de servidor de Academy sobre `academyData.ts` (design/web: `lessonHref`,
 * `lessonMeta`, `routeMin`, `rutaPage`): enlaces y minutos de cada lección, curso
 * siguiente y relacionados, tarjetas, metadatos, migas y JSON-LD.
 * Sin `'use client'`: solo lo importan páginas y componentes de servidor.
 */
import type { Metadata } from 'next';
import { breadcrumbJsonLd, type Crumb } from '@/components/site/Breadcrumbs/crumbs';
import { docById } from '@/components/site/docs/docsContent';
import { academyHref, blogPostHref, docHref } from '@/components/site/resources/resourceLinks';
import { academyRouteId } from '@/lib/academy-routes';
import { DOC_ROUTES } from '@/lib/docs-routes';
import type { SiteHref } from '@/lib/site-links';
import type { SiteT } from '@/lib/site-t';
import { sitePageMetadata } from '@/lib/site-metadata';
import { SITE_ORIGIN, absoluteUrl, publicPath, type SiteLanguage } from '@/lib/site-routes';
import type { AcademyArtKey } from './AcademyArt';
import {
  ACADEMY_COURSES_DATA,
  ACADEMY_LEVELS,
  ACADEMY_POSTS,
  ACADEMY_PRODUCTS,
  ACADEMY_TYPES,
  type AcademyCourseData,
  type AcademyLesson,
  type AcademyPostData,
} from './academyData';

export const A = 'site.academy';

/* ---------- Búsquedas ---------- */

/** Curso por el slug de la ruta interna (`/academy/[course]` usa el slug en inglés). */
export function courseByInternalSlug(slug: string): AcademyCourseData | undefined {
  return ACADEMY_COURSES_DATA.find((c) => c.slug.en === slug);
}

function postByRef(ref: AcademyPostData['ref']): AcademyPostData {
  const post = ACADEMY_POSTS.find((p) => p.ref === ref);
  if (!post) throw new Error(`academy: artículo desconocido ${ref}`);
  return post;
}

function nameOf<T extends { id: string; name: Record<SiteLanguage, string> }>(
  list: readonly T[],
  id: T['id'],
  lang: SiteLanguage
): string {
  const item = list.find((x) => x.id === id);
  if (!item) throw new Error(`academy: id desconocido ${id}`);
  return item.name[lang];
}

export const typeName = (c: AcademyCourseData, lang: SiteLanguage) => nameOf(ACADEMY_TYPES, c.type, lang);
export const levelName = (c: AcademyCourseData, lang: SiteLanguage) => nameOf(ACADEMY_LEVELS, c.level, lang);
export const productNames = (c: AcademyCourseData, lang: SiteLanguage) =>
  c.products.map((p) => nameOf(ACADEMY_PRODUCTS, p, lang));

/* ---------- Lecciones ---------- */

export interface LessonView {
  title: string;
  kind: AcademyLesson['kind'];
  /** `null`: el artículo no está en el blog (`content/blog`). Se ve, no navega. */
  href: SiteHref | null;
  summary: string;
  /** Minutos de lectura; las páginas no suman (0). */
  minutes: number;
}

const stripMarks = (text: string) => text.replace(/\*\*/g, '');

/** Enlace, resumen y minutos de una lección (corrección 1: de `docsData` y de los datos del blog). */
export function lessonView(lesson: AcademyLesson, lang: SiteLanguage): LessonView {
  const title = lesson.title[lang];
  if (lesson.kind === 'doc') {
    const doc = docById(lesson.ref);
    const route = DOC_ROUTES.find((d) => d.id === lesson.ref);
    return {
      title,
      kind: 'doc',
      href: route ? docHref(route.slug[lang], lang) : null,
      summary: stripMarks(doc.summary[lang]),
      minutes: doc.minutes,
    };
  }
  if (lesson.kind === 'post') {
    const post = postByRef(lesson.ref);
    return { title, kind: 'post', href: blogPostHref(post.slug[lang], lang), summary: post.excerpt[lang], minutes: post.minutes };
  }
  return { title, kind: 'page', href: publicPath(lesson.ref, lang) as SiteHref, summary: '', minutes: 0 };
}

export function courseMinutes(course: AcademyCourseData, lang: SiteLanguage): number {
  return course.lessons.reduce((n, l) => n + lessonView(l, lang).minutes, 0);
}

export function courseHref(course: AcademyCourseData, lang: SiteLanguage): SiteHref {
  const href = academyHref(course.slug[lang], lang);
  if (!href) throw new Error(`academy: curso sin ruta ${course.id}`);
  return href;
}

/** "Siguiente curso", en orden circular. */
export function nextCourse(course: AcademyCourseData): AcademyCourseData {
  const i = ACADEMY_COURSES_DATA.findIndex((c) => c.id === course.id);
  const next = ACADEMY_COURSES_DATA[(i + 1) % ACADEMY_COURSES_DATA.length];
  if (!next) throw new Error('academy: sin cursos');
  return next;
}

/** "Sigue aprendiendo": hasta 3 cursos que comparten un producto (sin el actual ni el siguiente). */
export function relatedCourses(course: AcademyCourseData): AcademyCourseData[] {
  const next = nextCourse(course);
  return ACADEMY_COURSES_DATA.filter(
    (c) => c.id !== course.id && c.id !== next.id && c.products.some((p) => course.products.includes(p))
  ).slice(0, 3);
}

export function startCourse(): AcademyCourseData {
  const course = ACADEMY_COURSES_DATA.find((c) => c.start) ?? ACADEMY_COURSES_DATA[0];
  if (!course) throw new Error('academy: sin cursos');
  return course;
}

/* ---------- Tarjetas ---------- */

/** Ilustración de cada curso en su tarjeta (design/web: `ROUTE_ART`). */
const COURSE_ART: Record<AcademyCourseData['id'], AcademyArtKey> = {
  'primer-agente': 'agentes',
  tienda: 'tiendas',
  puntaje: 'comerciales',
  vender: 'crm',
  citas: 'agenda',
  agencias: 'integraciones',
};

/** Pantalla de ejemplo de la barra lateral del curso (design/web: `ROUTE_VIS`). */
export const COURSE_VIS: Record<AcademyCourseData['id'], 'agentes' | 'bandeja' | 'crm' | 'agenda'> = {
  'primer-agente': 'agentes',
  tienda: 'agentes',
  puntaje: 'crm',
  vender: 'crm',
  citas: 'agenda',
  agencias: 'bandeja',
};

export const TINTS = ['g1', 'g2', 'g3', 'g4', 'g5'] as const;
export type Tint = (typeof TINTS)[number];

export function tintAt(i: number): Tint {
  return TINTS[i % TINTS.length] ?? 'g1';
}

export interface CourseCardView {
  id: AcademyCourseData['id'];
  href: SiteHref;
  title: string;
  goal: string;
  level: string;
  /** "Curso · 6 lecciones · 22 min". */
  meta: string;
  lessons: number;
  art: AcademyArtKey;
  tint: Tint;
}

export function courseCardView(course: AcademyCourseData, lang: SiteLanguage, t: SiteT): CourseCardView {
  const index = ACADEMY_COURSES_DATA.findIndex((c) => c.id === course.id);
  return {
    id: course.id,
    href: courseHref(course, lang),
    title: course.title[lang],
    goal: course.goal[lang],
    level: levelName(course, lang),
    meta: t(`${A}.card.meta`, {
      type: typeName(course, lang),
      lessons: course.lessons.length,
      minutes: courseMinutes(course, lang),
    }),
    lessons: course.lessons.length,
    art: COURSE_ART[course.id],
    tint: tintAt(index),
  };
}

/* ---------- Metadatos ---------- */

const TITLE_MAX = 60;

/** Corrección 5: `{título} | Academy | GenSmart`; si pasa de 60, `{título} | GenSmart`. */
export function courseTitle(course: AcademyCourseData, lang: SiteLanguage, t: SiteT): string {
  const title = course.title[lang];
  const full = `${title} | ${t('site.meta.academy.courseSuffix')}`;
  return full.length <= TITLE_MAX ? full : `${title} | GenSmart`;
}

export function academyIndexMetadata(lang: SiteLanguage, t: SiteT): Metadata {
  return sitePageMetadata('academy', lang, {
    title: t('site.meta.academy.title'),
    description: t('site.meta.academy.description'),
    ogAlt: t('site.meta.academy.ogAlt'),
  });
}

export function courseMetadata(course: AcademyCourseData, lang: SiteLanguage, t: SiteT): Metadata {
  return sitePageMetadata(academyRouteId(course.id), lang, {
    title: courseTitle(course, lang, t),
    description: course.goal[lang],
    ogAlt: course.title[lang],
  });
}

/* ---------- Migas y JSON-LD ---------- */

export const ACADEMY_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'academy', labelKey: 'site.crumbs.academy' },
];

/** Inicio / Academy / {Curso}. El tipo ("Curso") no tiene página: va como etiqueta sobre el título. */
export function courseCrumbs(course: AcademyCourseData, lang: SiteLanguage): Crumb[] {
  return [
    ...ACADEMY_CRUMBS,
    { id: academyRouteId(course.id), labelKey: `academy-course-${course.id}`, label: course.title[lang] },
  ];
}

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: 'GenSmart',
  url: `${SITE_ORIGIN}/`,
};

const courseUrl = (course: AcademyCourseData, lang: SiteLanguage) => absoluteUrl(courseHref(course, lang));

/** Minutos a ISO 8601 (`PT22M`, `PT1H5M`). */
export function isoMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? `${h}H` : ''}${m || !h ? `${m}M` : ''}`;
}

export function academyIndexJsonLd(lang: SiteLanguage, t: SiteT): object {
  const url = absoluteUrl(publicPath('academy', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(ACADEMY_CRUMBS, t, lang),
      {
        '@type': 'ItemList',
        '@id': `${url}#courses`,
        name: t(`${A}.catalog.title`),
        numberOfItems: ACADEMY_COURSES_DATA.length,
        itemListElement: ACADEMY_COURSES_DATA.map((course, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Course',
            '@id': `${courseUrl(course, lang)}#course`,
            name: course.title[lang],
            description: course.goal[lang],
            url: courseUrl(course, lang),
            provider: ORGANIZATION,
          },
        })),
      },
    ],
  };
}

export function courseJsonLd(course: AcademyCourseData, lang: SiteLanguage, t: SiteT): object {
  const url = courseUrl(course, lang);
  const parts = course.lessons
    .map((l) => lessonView(l, lang))
    .filter((l): l is LessonView & { href: SiteHref } => l.href !== null)
    .map((l) => ({ '@type': 'CreativeWork', name: l.title, url: absoluteUrl(l.href) }));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(courseCrumbs(course, lang), t, lang),
      {
        '@type': 'Course',
        '@id': `${url}#course`,
        name: course.title[lang],
        description: course.goal[lang],
        url,
        inLanguage: lang,
        provider: ORGANIZATION,
        isAccessibleForFree: true,
        educationalLevel: levelName(course, lang),
        timeRequired: isoMinutes(courseMinutes(course, lang)),
        hasPart: parts,
      },
    ],
  };
}
