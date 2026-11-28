import React from 'react';
import styles from './ReportCard.module.css';

export interface ReportCardProps {
  title: string;
  /** La frase bajo el título (p. ej. la franja pico). */
  lead?: string | null;
  children: React.ReactNode;
}

/** Tarjeta de un bloque de Informes (`.card` del diseño). */
export default function ReportCard({ title, lead, children }: ReportCardProps) {
  return (
    <section className={styles.card}>
      <h2 className={styles.title}>{title}</h2>
      {lead && <p className={styles.lead}>{lead}</p>}
      {children}
    </section>
  );
}
