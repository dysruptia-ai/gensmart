import type { ReactNode } from 'react';
import styles from './Section.module.css';

export type SectionSurface = 'dark' | 'alt' | 'light' | 'brand';
export type SectionRhythm = 'xs' | 's' | 'm' | 'l';

interface SectionProps {
  surface?: SectionSurface;
  rhythm?: SectionRhythm;
  id?: string;
  className?: string;
  children?: ReactNode;
}

export default function Section({
  surface = 'dark',
  rhythm = 'm',
  id,
  className,
  children,
}: SectionProps) {
  const classes = [styles.section, styles[surface], styles[`rhythm-${rhythm}`], className]
    .filter(Boolean)
    .join(' ');
  return (
    <section id={id} className={classes}>
      {children}
    </section>
  );
}
