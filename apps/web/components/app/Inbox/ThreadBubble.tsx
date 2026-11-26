'use client';

import React, { memo } from 'react';
import { FileText, Image as ImageIcon, Mic, RefreshCw, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { clockTime } from './inboxFormat';
import type { ThreadMessage } from './types';
import styles from './ThreadBubble.module.css';

export interface ThreadBubbleProps {
  message: ThreadMessage;
  /** Nombre de la persona del equipo (mensajes `human`). */
  authorName: string | null;
  /** El mensaje anterior es del mismo autor: no se repite el nombre. */
  continued: boolean;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}

const HANDOFF_URL_PREFIX = 'https://wa.me/';

/**
 * Un mensaje del hilo. Cliente a la izquierda; agente a la derecha (verde); persona del equipo a la
 * derecha, en azul y con su nombre; el resumen de la intervención, centrado.
 */
function ThreadBubble({ message, authorName, continued, onRetry, onDiscard }: ThreadBubbleProps) {
  const { t, language } = useTranslation();
  const { role, content, metadata } = message;

  if (role === 'system') {
    if (metadata.type !== 'intervention_summary') return null;
    return (
      <div className={styles.system}>
        <span className={styles.systemLabel}>{t('inbox.thread.events.released')}</span>
        <p className={styles.summary}>{content}</p>
      </div>
    );
  }

  const handoff =
    metadata.handoff && typeof metadata.handoff.url === 'string' && metadata.handoff.url.startsWith(HANDOFF_URL_PREFIX)
      ? metadata.handoff
      : null;
  // En la web la URL del traspaso también va en el texto, en su propia línea: se esconde esa línea
  const text = handoff && content.endsWith(`\n${handoff.url}`) ? content.slice(0, -(handoff.url.length + 1)) : content;
  const images = metadata.hasImages ? (metadata.images ?? []).filter((img) => img.data) : [];
  const side = role === 'user' ? styles.in : role === 'human' ? styles.human : styles.out;
  const hideText = (text === '[Image]' && metadata.hasImages) || (message.delivery === 'sending' && metadata.isVoiceMessage);

  return (
    <div className={`${styles.wrap} ${role === 'user' ? styles.wrapIn : styles.wrapOut}`}>
      {role === 'human' && !continued && <span className={styles.by}>{authorName || t('inbox.row.team')}</span>}
      {role === 'assistant' && !continued && <span className={`${styles.by} ${styles.byAgent}`}>{authorName || t('inbox.row.agent')}</span>}
      <div className={`${styles.bubble} ${side} ${message.delivery === 'failed' ? styles.failed : ''}`}>
        {metadata.isVoiceMessage && (
          <span className={styles.attachment}>
            <Mic size={14} aria-hidden="true" />
            {t('chat_voice_message')}
          </span>
        )}
        {metadata.media && (
          <div className={styles.media}>
            {metadata.media.type === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={metadata.media.url}
                alt={metadata.media.caption ?? t('inbox.thread.mediaAlt')}
                className={styles.mediaImage}
                loading="lazy"
              />
            )}
            {metadata.media.type === 'document' && (
              <a href={metadata.media.url} target="_blank" rel="noopener noreferrer" className={styles.document}>
                <FileText size={18} aria-hidden="true" />
                {t('inbox.thread.viewDocument')}
              </a>
            )}
            {metadata.media.type === 'video' && <video src={metadata.media.url} controls className={styles.mediaImage} />}
            {metadata.media.caption && <p className={styles.caption}>{metadata.media.caption}</p>}
          </div>
        )}
        {images.length > 0 ? (
          <div className={styles.gallery}>
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={t('inbox.thread.imageAlt', { n: i + 1 })}
                className={styles.mediaImage}
              />
            ))}
          </div>
        ) : metadata.hasImages ? (
          <span className={styles.attachment}>
            <ImageIcon size={14} aria-hidden="true" />
            {metadata.imageCount && metadata.imageCount > 1
              ? `${metadata.imageCount} ${t('chat_images_indicator')}`
              : t('chat_image_indicator')}
          </span>
        ) : null}
        {!hideText && text && <p className={styles.text}>{text}</p>}
        {handoff && (
          <div className={styles.handoff}>
            <a href={handoff.url} target="_blank" rel="noopener noreferrer" className={styles.handoffButton}>
              {handoff.buttonText}
            </a>
            {handoff.contactName && (
              <span className={styles.handoffTo}>{t('inbox.thread.handedOffTo', { name: handoff.contactName })}</span>
            )}
          </div>
        )}
        <span className={styles.meta}>
          {message.delivery === 'sending' ? (
            t('inbox.composer.sending')
          ) : message.delivery === 'failed' ? (
            <span className={styles.failText}>{t('inbox.composer.failed')}</span>
          ) : (
            <time dateTime={message.createdAt}>{clockTime(message.createdAt, language)}</time>
          )}
        </span>
      </div>
      {message.delivery === 'failed' && (
        <span className={styles.failActions}>
          <button type="button" onClick={() => onRetry(message.id)}>
            <RefreshCw size={13} aria-hidden="true" />
            {t('inbox.retry')}
          </button>
          <button type="button" onClick={() => onDiscard(message.id)}>
            <X size={13} aria-hidden="true" />
            {t('inbox.composer.discard')}
          </button>
        </span>
      )}
    </div>
  );
}

export default memo(ThreadBubble);
