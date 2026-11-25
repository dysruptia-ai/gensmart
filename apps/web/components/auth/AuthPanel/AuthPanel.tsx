'use client';

import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { AuthPanelVariant } from '../AuthScreenContext';
import styles from './AuthPanel.module.css';

/**
 * Panel oscuro de la derecha (siempre oscuro, en los dos temas): mensaje de marca y una
 * conversación de ejemplo, rotulada como ilustrativa. Se oculta bajo 960 px.
 */
export default function AuthPanel({ variant }: { variant: Exclude<AuthPanelVariant, null> }) {
  const { t } = useTranslation();
  const k = variant === 'login' ? 'login' : 'register';
  const messages: Array<{ dir: 'in' | 'out'; key: string }> = [
    { dir: 'in', key: 'm1' },
    { dir: 'out', key: 'm2' },
    { dir: 'in', key: 'm3' },
    { dir: 'out', key: 'm4' },
  ];
  return (
    <aside className={styles.panel} aria-hidden="true">
      <div>
        <span className={styles.eyebrow}>{t('access.panel.eyebrow')}</span>
        <h2 className={styles.heading}>
          {t(`access.panel.${k}TitleA`)}
          <em>{t(`access.panel.${k}TitleEm`)}</em>
          {t(`access.panel.${k}TitleB`)}
        </h2>
        <p className={styles.text}>{t(`access.panel.${k}Text`)}</p>
      </div>
      <div>
        <p className={styles.caption}>{t('access.panel.caption', { industry: t('access.panel.industry') })}</p>
        <div className={styles.conv}>
          <header className={styles.convHead}>
            <i className={styles.dot} />
            <b>{t('access.panel.live')}</b>
          </header>
          <div className={styles.msgs}>
            {messages.map((m, i) => (
              <div
                key={`${variant}-${m.key}`}
                className={`${styles.msg} ${m.dir === 'in' ? styles.in : styles.out}`}
                style={{ animationDelay: `${i * 450}ms` }}
              >
                {t(`access.panel.${m.key}`)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
