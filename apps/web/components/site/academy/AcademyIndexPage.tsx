import { ArrowRight } from 'lucide-react';
import Breadcrumbs from '@/components/site/Breadcrumbs';
import Container from '@/components/site/Container';
import GlowBackdrop from '@/components/site/GlowBackdrop';
import Section from '@/components/site/Section';
import SiteLink from '@/components/site/SiteLink';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import AcademyArt from './AcademyArt';
import {
  AcademyCatalogProvider,
  CatalogCount,
  CatalogFilters,
  CatalogGrid,
  CatalogSearch,
  FilterLink,
  type CatalogItem,
  type FilterGroup,
} from './AcademyCatalog';
import {
  A,
  ACADEMY_CRUMBS,
  courseCardView,
  courseHref,
  productNames,
  startCourse,
  tintAt,
} from './academyContent';
import { ACADEMY_AUDIENCES, ACADEMY_COURSES_DATA, ACADEMY_LEVELS, ACADEMY_PRODUCTS, ACADEMY_TYPES } from './academyData';
import CourseCard from './CourseCard';
import cardStyles from './CourseCard.module.css';
import styles from './AcademyIndexPage.module.css';

/** Ancla del catálogo (design/web: `#ac-cat`). */
const CATALOG_ID = 'ac-cat';

interface AcademyIndexPageProps {
  lang: SiteLanguage;
}

/** Índice de Academy (design/web: `academia()`). */
export default function AcademyIndexPage({ lang }: AcademyIndexPageProps) {
  const t = siteT(lang);
  const start = startCourse();
  const usedTypes = ACADEMY_TYPES.filter((x) => ACADEMY_COURSES_DATA.some((c) => c.type === x.id));
  const usedProducts = ACADEMY_PRODUCTS.filter((x) => ACADEMY_COURSES_DATA.some((c) => c.products.includes(x.id)));
  const countFor = (product: string) => ACADEMY_COURSES_DATA.filter((c) => c.products.some((p) => p === product)).length;
  const opts = <T extends { id: string; name: Record<SiteLanguage, string> }>(list: readonly T[]) =>
    list.map((x) => ({ id: x.id, name: x.name[lang] }));

  // Tipo solo si hay más de uno con contenido (design/web: `usedTypes().length > 1`)
  const groups: FilterGroup[] = [
    ...(usedTypes.length > 1 ? [{ id: 'type' as const, label: t(`${A}.filters.type`), options: opts(usedTypes) }] : []),
    { id: 'products', label: t(`${A}.filters.products`), options: opts(usedProducts) },
    { id: 'level', label: t(`${A}.filters.level`), options: opts(ACADEMY_LEVELS) },
    { id: 'aud', label: t(`${A}.filters.aud`), options: opts(ACADEMY_AUDIENCES) },
  ];

  const items: CatalogItem[] = ACADEMY_COURSES_DATA.map((c) => ({
    id: c.id,
    type: c.type,
    level: c.level,
    products: c.products,
    audience: c.audience,
    text: [c.title[lang], c.goal[lang], ...productNames(c, lang)].join(' '),
  }));

  const cards = ACADEMY_COURSES_DATA.map((c) => ({
    id: c.id,
    node: <CourseCard course={courseCardView(c, lang, t)} />,
  }));

  return (
    <AcademyCatalogProvider items={items}>
      <section className={styles.hero}>
        <GlowBackdrop />
        <Container className={styles.heroInner}>
          <Breadcrumbs crumbs={ACADEMY_CRUMBS} className={styles.crumbs} />
          <div className={styles.heroText}>
            <span className={styles.eyebrow}>{t(`${A}.hero.eyebrow`)}</span>
            <h1 className={styles.title}>{t(`${A}.hero.title`)}</h1>
            <p className={styles.lead}>{t(`${A}.hero.lead`)}</p>
            <CatalogSearch targetId={CATALOG_ID} />
          </div>
          <ul className={styles.entries}>
            <li>
              <SiteLink href={courseHref(start, lang)} className={styles.entry}>
                <span className={`${styles.entryArt} ${cardStyles.g1}`}>
                  <AcademyArt name="start" />
                </span>
                <span className={styles.entryBody}>
                  <b>{t(`${A}.hero.startTitle`)}</b>
                  <small>{start.title[lang]}</small>
                  <span className={styles.entryBtn}>
                    {t(`${A}.hero.startCta`)} <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </span>
              </SiteLink>
            </li>
            {ACADEMY_AUDIENCES.slice(0, 4).map((a, k) => (
              <li key={a.id}>
                <FilterLink group="aud" value={a.id} targetId={CATALOG_ID} className={styles.entry}>
                  <span className={`${styles.entryArt} ${cardStyles[tintAt(k + 1)]}`}>
                    <AcademyArt name={a.id} />
                  </span>
                  <span className={styles.entryBody}>
                    <b>{a.name[lang]}</b>
                    <small>{a.description[lang]}</small>
                  </span>
                </FilterLink>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Section surface="dark" id={CATALOG_ID} className={`${styles.sec} ${styles.cat}`}>
        <Container>
          <h2 className={styles.h2}>{t(`${A}.catalog.title`)}</h2>
          <CatalogFilters groups={groups} />
          <CatalogCount />
          <CatalogGrid cards={cards} />
          <div className={styles.note}>
            <p>
              <strong>{t(`${A}.catalog.noteTitle`)}</strong> {t(`${A}.catalog.noteText`)}
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="dark" className={styles.sec}>
        <Container>
          <h2 className={styles.h2}>{t(`${A}.products.title`)}</h2>
          <ul className={styles.products}>
            {ACADEMY_PRODUCTS.map((p) => {
              const n = countFor(p.id);
              const inner = (
                <>
                  <span className={styles.productArt}>
                    <AcademyArt name={p.id} />
                  </span>
                  <span className={styles.productBody}>
                    <b>{p.name[lang]}</b>
                    <span>{p.description[lang]}</span>
                    <em>
                      {n
                        ? t(n === 1 ? `${A}.catalog.countOne` : `${A}.catalog.countOther`, { n })
                        : t(`${A}.products.soon`)}
                    </em>
                  </span>
                </>
              );
              return (
                <li key={p.id}>
                  {n ? (
                    <FilterLink group="products" value={p.id} targetId={CATALOG_ID} className={styles.product}>
                      {inner}
                    </FilterLink>
                  ) : (
                    <div className={`${styles.product} ${styles.soon}`}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>
    </AcademyCatalogProvider>
  );
}
