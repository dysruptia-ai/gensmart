import styles from './NumberedCards.module.css';

export interface NumberedCard {
  title: string;
  text: string;
}

interface NumberedCardsProps {
  items: readonly NumberedCard[];
  /** Línea que une las tarjetas (pasos de "Cómo arranca"; design/web: `.is-partners .steps`). */
  connected?: boolean;
}

/** Tarjetas numeradas 01, 02, 03 (design/web: `.is-partners .why` y `.steps`). */
export default function NumberedCards({ items, connected = false }: NumberedCardsProps) {
  return (
    <ol className={connected ? `${styles.cards} ${styles.connected}` : styles.cards}>
      {items.map((item, i) => (
        <li key={item.title} className={styles.card}>
          <span className={styles.n} aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <h3 className={styles.title}>{item.title}</h3>
          <p className={styles.text}>{item.text}</p>
        </li>
      ))}
    </ol>
  );
}
