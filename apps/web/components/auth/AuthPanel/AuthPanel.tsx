'use client';

import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './AuthPanel.module.css';

export interface AuthPanelMessage {
  dir: 'in' | 'out';
  text: string;
}

export interface AuthPanelFrameProps {
  eyebrow: string;
  /** Título; `em` va en verde. */
  heading: { before: string; em?: string; after?: string };
  text?: string;
  caption: string;
  live: string;
  messages: AuthPanelMessage[];
  /** Cambia cuando cambia la conversación (vuelve a animar los mensajes). */
  conversationKey: string;
  /** Contenido debajo de la conversación (la lista del cuestionario). */
  children?: React.ReactNode;
}

/**
 * Panel oscuro de la derecha (siempre oscuro, en los dos temas): mensaje de marca y una
 * conversación de ejemplo, rotulada como ilustrativa. Se oculta bajo 960 px.
 */
export function AuthPanelFrame({ eyebrow, heading, text, caption, live, messages, conversationKey, children }: AuthPanelFrameProps) {
  return (
    <aside className={styles.panel} aria-hidden="true">
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 className={styles.heading}>
          {heading.before}
          {heading.em && <em>{heading.em}</em>}
          {heading.after}
        </h2>
        {text && <p className={styles.text}>{text}</p>}
      </div>
      <div>
        <p className={styles.caption}>{caption}</p>
        <div className={styles.conv}>
          <header className={styles.convHead}>
            <i className={styles.dot} />
            <b>{live}</b>
          </header>
          <div className={styles.msgs}>
            {messages.map((m, i) => (
              <div
                key={`${conversationKey}-${i}`}
                className={`${styles.msg} ${m.dir === 'in' ? styles.in : styles.out}`}
                style={{ animationDelay: `${i * 450}ms` }}
              >
                {m.text}
              </div>
            ))}
          </div>
        </div>
      </div>
      {children}
    </aside>
  );
}

/** Panel del ingreso y del registro. */
export default function AuthPanel({ variant }: { variant: 'login' | 'register' }) {
  const { t } = useTranslation();
  const k = variant;
  const dirs: Array<'in' | 'out'> = ['in', 'out', 'in', 'out'];
  return (
    <AuthPanelFrame
      eyebrow={t('access.panel.eyebrow')}
      heading={{
        before: t(`access.panel.${k}TitleA`),
        em: t(`access.panel.${k}TitleEm`),
        after: t(`access.panel.${k}TitleB`),
      }}
      text={t(`access.panel.${k}Text`)}
      caption={t('access.panel.caption', { industry: t('access.panel.industry') })}
      live={t('access.panel.live')}
      messages={dirs.map((dir, i) => ({ dir, text: t(`access.panel.m${i + 1}`) }))}
      conversationKey={variant}
    />
  );
}
