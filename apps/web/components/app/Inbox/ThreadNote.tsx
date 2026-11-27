'use client';

import React from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { clockTime } from './inboxFormat';
import type { ApiNote } from './types';
import styles from './ThreadNote.module.css';

export interface ThreadNoteProps {
  note: ApiNote;
  userId: string | undefined;
  onAskDelete?: (noteId: string) => void;
}

/** Nota interna en el hilo (web-43). El cuerpo se pinta como texto, nunca como HTML. */
export default function ThreadNote({ note, userId, onAskDelete }: ThreadNoteProps) {
  const { t, language } = useTranslation();
  const author = note.authorUserId && note.authorUserId === userId ? t('inbox.row.you') : note.authorName || t('inbox.row.team');
  return (
    <div className={styles.note}>
      <div className={styles.label}>
        <Lock size={11} aria-hidden="true" />
        {t('inbox.notes.badge')}
        {note.canDelete && onAskDelete && (
          <button type="button" className={styles.delete} onClick={() => onAskDelete(note.id)} aria-label={t('inbox.notes.delete')} title={t('inbox.notes.delete')}>
            <Trash2 size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className={styles.body}>{note.body}</p>
      <p className={styles.meta}>
        <time dateTime={note.createdAt}>{clockTime(note.createdAt, language)}</time> · {author} · {t('inbox.notes.onlyTeam')}
      </p>
    </div>
  );
}
