'use client';

import { useTranslation } from '@/hooks/useTranslation';
import ChatBubble from '../ChatBubble';
import { COMMON, range, teamKey, type TeamData } from './teamsData';
import styles from './TeamHeroChat.module.css';

interface TeamHeroChatProps {
  team: TeamData;
}

/**
 * Chat de ejemplo del hero (design/web: `.chat`). Maqueta: nada enfocable.
 * El rótulo sale de `console.label` (bilingüe), no de `chat.label` del diseño.
 */
export default function TeamHeroChat({ team }: TeamHeroChatProps) {
  const { t } = useTranslation();
  const k = teamKey(team.id);
  const agent = t(`${k}.label`);
  return (
    <div className={styles.chat} role="group" aria-label={t(`${COMMON}.chatLabel`, { agent })}>
      <p className={styles.head}>
        <i aria-hidden="true" />
        {agent}
      </p>
      <div className={styles.msgs}>
        {team.heroChat.map((dir, i) => (
          <ChatBubble key={i} direction={dir} className={styles.bubble}>
            {t(`${k}.chat.m${i + 1}`)}
          </ChatBubble>
        ))}
      </div>
      <ul className={styles.chips}>
        {range(team.chips).map((i) => (
          <li key={i} className={i === team.chips ? styles.on : undefined}>
            {t(`${k}.chat.chip${i}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
