import type { ReactNode } from 'react';
import Container from '../Container';
import FaqList, { type FaqItem } from '../FaqList';
import styles from './FaqSection.module.css';

interface FaqSectionProps {
  /** `id` del `h2` (para `aria-labelledby`). */
  headingId: string;
  kicker: string;
  title: { before: string; accent: string };
  help: { before: string; accent: string; after: string };
  /** Botón de contacto (`SiteButton`). */
  action: ReactNode;
  items: readonly FaqItem[];
}

/** Bloque de preguntas frecuentes en dos columnas (design/web: `.faq-split`). */
export default function FaqSection({ headingId, kicker, title, help, action, items }: FaqSectionProps) {
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <Container className={styles.split}>
        <div className={styles.side}>
          <p className={styles.kicker}>{kicker}</p>
          <h2 id={headingId} className={styles.title}>
            {title.before} <span className={styles.accent}>{title.accent}</span>
          </h2>
          <p className={styles.help}>
            {help.before} <span className={styles.accent}>{help.accent}</span> {help.after}
          </p>
          {action}
        </div>
        <FaqList items={items} />
      </Container>
    </section>
  );
}
