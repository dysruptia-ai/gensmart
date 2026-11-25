'use client';

import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import styles from './DocToc.module.css';

export interface TocItem {
  id: string;
  text: string;
}

interface DocTocProps {
  items: TocItem[];
  /** `side`: columna pegajosa en escritorio; `inline`: caja al inicio del contenido (pantallas medianas). */
  variant: 'side' | 'inline';
  /** Ancla de la valoración ("¿Te resultó útil?"), solo en la columna. */
  feedbackId?: string;
}

/** "En esta página": índice de los `h2` con la sección visible resaltada (`aria-current="location"`). */
export default function DocToc({ items, variant, feedbackId }: DocTocProps) {
  const { t } = useSiteTranslation();
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;
    // La sección actual es el último h2 que ya pasó por la franja superior de la pantalla
    const update = () => {
      const line = window.innerHeight * 0.3;
      let current: string | null = null;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= line) current = h.id;
      }
      setActive(current ?? headings[0]?.id ?? null);
    };
    const observer = new IntersectionObserver(update, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
    headings.forEach((h) => observer.observe(h));
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
    };
  }, [items]);

  const label = t('site.docs.guide.toc');
  const side = variant === 'side';
  return (
    <nav className={side ? styles.side : styles.inline} aria-label={label}>
      <p className={styles.label} aria-hidden="true">
        {label}
      </p>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={side && active === item.id ? 'location' : undefined}>
              {item.text}
            </a>
          </li>
        ))}
      </ol>
      {side && feedbackId ? (
        <a className={styles.feedback} href={`#${feedbackId}`}>
          {t('site.docs.guide.tocFeedback')} <ArrowDown size={14} aria-hidden="true" />
        </a>
      ) : null}
    </nav>
  );
}
