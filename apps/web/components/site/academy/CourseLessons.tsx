'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import PendingLink from '../resources/PendingLink';
import type { LessonView } from './academyContent';
import { ProgressBar } from './CourseProgress';
import { useCourseProgress } from './useCourseProgress';
import styles from './AcademyCoursePage.module.css';

interface CourseLessonsProps {
  courseId: string;
  lessons: readonly LessonView[];
}

/** Lecciones del curso, en orden, con "Marcar como hecha" (design/web: `.ac-list`). */
export function CourseLessons({ courseId, lessons }: CourseLessonsProps) {
  const { t } = useTranslation();
  const { isDone, toggle } = useCourseProgress(courseId, lessons.length);
  return (
    <ol className={styles.list}>
      {lessons.map((lesson, i) => {
        const done = isDone(i);
        return (
          <li key={i} className={done ? styles.isDone : undefined}>
            <label className={styles.check}>
              <input type="checkbox" checked={done} onChange={(e) => toggle(i, e.target.checked)} />
              <span className={styles.srOnly}>{t('site.academy.course.markDone', { lesson: lesson.title })}</span>
              <i aria-hidden="true" />
            </label>
            <PendingLink href={lesson.href} className={styles.lesson}>
              <span className={styles.num} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={styles.text}>
                <b>{lesson.title}</b>
                {lesson.summary ? <small>{lesson.summary}</small> : null}
              </span>
              <span className={styles.tags}>
                <em>{t(`site.academy.course.kind.${lesson.kind}`)}</em>
                {lesson.minutes ? <em>{t('site.academy.course.minutes', { minutes: lesson.minutes })}</em> : null}
              </span>
              <ArrowRight className={styles.go} size={18} aria-hidden="true" />
            </PendingLink>
          </li>
        );
      })}
    </ol>
  );
}

/** "x/N lecciones" con la barra, en la barra lateral. */
export function CourseProgressBox({ courseId, total }: { courseId: string; total: number }) {
  const { t } = useTranslation();
  const { count } = useCourseProgress(courseId, total);
  return (
    <>
      <p className={styles.big}>
        <b>{count}</b>/{total} <span>{t('site.academy.course.lessonsUnit')}</span>
      </p>
      <ProgressBar count={count} total={total} className={styles.boxBar} />
    </>
  );
}
