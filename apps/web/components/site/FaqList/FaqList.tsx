import type { FaqItem } from './faq';
import styles from './FaqList.module.css';

interface FaqListProps {
  items: readonly FaqItem[];
  /** Abre la primera pregunta al cargar (como el diseño). */
  openFirst?: boolean;
  className?: string;
}

/**
 * Preguntas en <details>/<summary>: abren con teclado y se leen sin JS.
 * La numeración es decorativa (oculta para lectores de pantalla).
 */
export default function FaqList({ items, openFirst = true, className }: FaqListProps) {
  return (
    <div className={[styles.faq, className].filter(Boolean).join(' ')}>
      {items.map((item, i) => (
        <details key={item.question} className={styles.item} open={openFirst && i === 0}>
          <summary className={styles.summary}>
            <span className={styles.num} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={styles.question}>{item.question}</span>
          </summary>
          <p className={styles.answer}>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
