import type { LucideIcon } from 'lucide-react';
import styles from './IconList.module.css';

export interface IconListItem {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** Lista de recursos o servicios con icono, en dos columnas (design/web: `.is-partners .entrega`). */
export default function IconList({ items }: { items: readonly IconListItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className={styles.item}>
          <span className={styles.icon} aria-hidden="true">
            <Icon size={20} strokeWidth={1.8} />
          </span>
          <div>
            <b className={styles.title}>{title}</b>
            <span className={styles.text}>{text}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
