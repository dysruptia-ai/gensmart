import { ArrowLeft, ArrowRight } from 'lucide-react';
import Container from '@/components/site/Container';
import PageHero from '@/components/site/PageHero';
import Section from '@/components/site/Section';
import SiteLink from '@/components/site/SiteLink';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import AcademyHeroVis from './AcademyHeroVis';
import {
  A,
  COURSE_VIS,
  courseCardView,
  courseCrumbs,
  courseHref,
  courseMinutes,
  lessonView,
  levelName,
  nextCourse,
  productNames,
  relatedCourses,
  typeName,
} from './academyContent';
import type { AcademyCourseData } from './academyData';
import CourseCard from './CourseCard';
import { CourseLessons, CourseProgressBox } from './CourseLessons';
import indexStyles from './AcademyIndexPage.module.css';
import styles from './AcademyCoursePage.module.css';

interface AcademyCoursePageProps {
  course: AcademyCourseData;
  lang: SiteLanguage;
}

/** Curso de Academy (design/web: `rutaPage()`). */
export default function AcademyCoursePage({ course, lang }: AcademyCoursePageProps) {
  const t = siteT(lang);
  const lessons = course.lessons.map((l) => lessonView(l, lang));
  const next = nextCourse(course);
  const related = relatedCourses(course);
  const total = lessons.length;

  return (
    <>
      <PageHero
        crumbs={courseCrumbs(course, lang)}
        eyebrow={typeName(course, lang)}
        title={{ before: course.title[lang] }}
        lead={course.goal[lang]}
        className={styles.hero}
      />

      <Section surface="dark" rhythm="s">
        <Container className={styles.layout}>
          <div className={styles.main}>
            <h2 className={styles.srOnly}>{t(`${A}.course.lessonsTitle`)}</h2>
            <CourseLessons courseId={course.id} lessons={lessons} />
          </div>
          <aside className={styles.aside} aria-label={t(`${A}.course.progress`)}>
            <div className={styles.vis}>
              <AcademyHeroVis name={COURSE_VIS[course.id]} lang={lang} />
            </div>
            <div className={styles.box}>
              <span className={styles.k}>{t(`${A}.course.progress`)}</span>
              <CourseProgressBox courseId={course.id} total={total} />
              <p className={styles.small}>{t(`${A}.course.total`, { minutes: courseMinutes(course, lang) })}</p>
            </div>
            <div className={styles.box}>
              <span className={styles.k}>
                {t(`${A}.course.level`)} · {levelName(course, lang)}
              </span>
              <ul className={styles.chips}>
                {productNames(course, lang).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <span className={`${styles.k} ${styles.k2}`}>{t(`${A}.course.byEnd`)}</span>
              <p className={`${styles.small} ${styles.goal}`}>{course.goal[lang]}</p>
            </div>
            <SiteLink href={courseHref(next, lang)} className={styles.next}>
              <span className={styles.k}>{t(`${A}.course.next`)}</span>
              <b>{next.title[lang]}</b>
              <ArrowRight className={styles.go} size={18} aria-hidden="true" />
            </SiteLink>
          </aside>
          <p className={styles.back}>
            <SiteLink to="academy">
              <ArrowLeft size={15} aria-hidden="true" /> {t(`${A}.course.all`)}
            </SiteLink>
          </p>
        </Container>
      </Section>

      {related.length ? (
        <Section surface="alt">
          <Container>
            <h2 className={indexStyles.h2}>{t(`${A}.course.keepLearning`)}</h2>
            <ul className={indexStyles.grid}>
              {related.map((c) => (
                <li key={c.id}>
                  <CourseCard course={courseCardView(c, lang, t)} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
