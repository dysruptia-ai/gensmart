'use client';

import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import ChatBubble from '../ChatBubble';
import { range, type SolutionData } from './solutionsData';
import styles from './SolutionHeroChat.module.css';

interface SolutionHeroChatProps {
  page: Pick<SolutionData, 'base' | 'common' | 'heroChat' | 'chips'>;
}

/**
 * Chat de ejemplo del hero y de las vistas del índice (design/web: `.chat`).
 * Maqueta: nada enfocable. El rótulo sale de `{base}.label` (bilingüe).
 */
export default function SolutionHeroChat({ page }: SolutionHeroChatProps) {
  const { t } = useSiteTranslation();
  const agent = t(`${page.base}.label`);
  return (
    <div className={styles.chat} role="group" aria-label={t(`${page.common}.chatLabel`, { agent })}>
      <p className={styles.head}>
        <i aria-hidden="true" />
        {agent}
      </p>
      <div className={styles.msgs}>
        {page.heroChat.map((dir, i) => (
          <ChatBubble key={i} direction={dir} className={styles.bubble}>
            {t(`${page.base}.chat.m${i + 1}`)}
          </ChatBubble>
        ))}
      </div>
      <ul className={styles.chips}>
        {range(page.chips).map((i) => (
          <li key={i} className={i === page.chips ? styles.on : undefined}>
            {t(`${page.base}.chat.chip${i}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
