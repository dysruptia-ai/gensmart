import { Check } from 'lucide-react';
import Link from 'next/link';
import AcademyArt from './AcademyArt';
import type { CourseCardView } from './academyContent';
import { CardProgress, CompleteMark } from './CourseProgress';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: CourseCardView;
}

/** Tarjeta de curso del catálogo y de "Sigue aprendiendo" (design/web: `courseCard`). */
export default function CourseCard({ course }: CourseCardProps) {
  return (
    <article className={styles.card}>
      <div className={`${styles.head} ${styles[course.tint]}`}>
        <span className={styles.level}>{course.level}</span>
        <AcademyArt name={course.art} />
        <CompleteMark courseId={course.id} total={course.lessons} className={styles.done}>
          <Check size={14} strokeWidth={3} />
        </CompleteMark>
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link href={course.href} className={styles.link}>
            {course.title}
          </Link>
        </h3>
        <p className={styles.goal}>{course.goal}</p>
        <p className={styles.meta}>{course.meta}</p>
        <CardProgress courseId={course.id} total={course.lessons} />
      </div>
    </article>
  );
}
