'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { applyReplyVariablesParts, type MenuMatch, type ReplyVariables } from './quickReplies';
import styles from './QuickReplyMenu.module.css';

export const QUICK_REPLIES_SETTINGS_HREF = '/dashboard/conversations/settings?tab=quick-replies';

export interface QuickReplyMenuProps {
  id: string;
  query: string;
  matches: MenuMatch[];
  active: number;
  /** La organización no tiene respuestas rápidas: se muestra el vacío. */
  empty: boolean;
  vars: ReplyVariables;
  isManager: boolean;
  onPick: (match: MenuMatch) => void;
  onHover: (index: number) => void;
}

export function optionId(menuId: string, index: number): string {
  return `${menuId}-opt-${index}`;
}

/** Menú de respuestas rápidas (web-43). El foco se queda en el cuadro de texto (patrón combobox). */
export default function QuickReplyMenu({ id, query, matches, active, empty, vars, isManager, onPick, onHover }: QuickReplyMenuProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.menu}>
      <div className={styles.head}>
        <span>{query ? t('inbox.quickReplies.menuTitleQuery', { query }) : t('inbox.quickReplies.menuTitle')}</span>
        {isManager && !empty && (
          <Link href={QUICK_REPLIES_SETTINGS_HREF} className={styles.manage}>
            {t('inbox.quickReplies.manage')}
          </Link>
        )}
      </div>
      {empty ? (
        <p className={styles.empty}>
          {t('inbox.quickReplies.empty')}{' '}
          {isManager ? (
            <Link href={QUICK_REPLIES_SETTINGS_HREF} className={styles.manage}>
              {t('inbox.quickReplies.createOne')}
            </Link>
          ) : (
            t('inbox.quickReplies.askAdmin')
          )}
        </p>
      ) : (
        <ul id={id} role="listbox" aria-label={t('inbox.quickReplies.menuTitle')} className={styles.list}>
          {matches.map((m, i) => {
            const [from, to] = m.shortcutRange ?? [0, 0];
            const s = m.reply.shortcut;
            return (
              <li
                key={m.reply.id}
                id={optionId(id, i)}
                role="option"
                aria-selected={i === active}
                className={styles.option}
                // mousedown: que el cuadro no pierda el foco antes del clic
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(m)}
                onMouseEnter={() => onHover(i)}
              >
                <span className={styles.shortcut}>
                  /{s.slice(0, from)}
                  {to > from && <mark className={styles.hit}>{s.slice(from, to)}</mark>}
                  {s.slice(to)}
                </span>
                <span className={styles.preview}>
                  {applyReplyVariablesParts(m.reply.body, vars).map((p, k) =>
                    p.variable === 'contact' ? (
                      <mark key={k} className={styles.value}>
                        {p.text}
                      </mark>
                    ) : (
                      <React.Fragment key={k}>{p.text}</React.Fragment>
                    ),
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!empty && (
        <p className={styles.foot} aria-hidden="true">
          {t('inbox.quickReplies.menuKeys')}
        </p>
      )}
    </div>
  );
}
