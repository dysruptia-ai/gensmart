'use client';

import React from 'react';
import { Image as ImageIcon, Mic, FileText } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'human' | 'system';
  content: string;
  createdAt: string;
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
    toolsCalled?: string[];
    type?: string;
    error?: boolean;
    hasImages?: boolean;
    imageCount?: number;
    images?: Array<{
      mimeType: string;
      data?: string;
      hasCaption: boolean;
    }>;
    isVoiceMessage?: boolean;
    media?: {
      type: 'image' | 'video' | 'document';
      url: string;
      caption?: string | null;
    };
  };
}

export default function MessageBubble({
  role,
  content,
  createdAt,
  metadata,
}: MessageBubbleProps) {
  const { t, language } = useTranslation();

  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString(language === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit' });
  }

  // Intervention summary — display as center divider
  if (role === 'system' && metadata?.type === 'intervention_summary') {
    return (
      <div className={styles.divider}>
        <span className={styles.dividerPill}>
          {t('conversations.messageBubble.aiResumed')} — {content}
        </span>
      </div>
    );
  }

  // Skip other system messages
  if (role === 'system') return null;

  const isOutgoing = role === 'assistant' || role === 'human';

  return (
    <div className={[styles.wrapper, isOutgoing ? styles.outgoing : styles.incoming].join(' ')}>
      <div
        className={[
          styles.bubble,
          role === 'assistant' ? styles.assistant :
          role === 'human' ? styles.human :
          styles.user,
        ].join(' ')}
      >
        {role === 'human' && (
          <span className={styles.humanLabel}>{t('conversations.chat.humanAgent')}</span>
        )}
        {metadata?.isVoiceMessage && (
          <div className={styles.voiceIndicator}>
            <Mic size={14} />
            <span>{t('chat_voice_message')}</span>
          </div>
        )}
        {metadata?.media && (
          <div className={styles.mediaMessage}>
            {metadata.media.type === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={metadata.media.url}
                alt={metadata.media.caption ?? t('conversations.chat.mediaSentByAgent')}
                className={styles.mediaImage}
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            {metadata.media.type === 'document' && (
              <a
                href={metadata.media.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mediaDocument}
              >
                <FileText size={20} />
                <span>{t('conversations.chat.viewDocument')}</span>
              </a>
            )}
            {metadata.media.type === 'video' && (
              <video
                src={metadata.media.url}
                controls
                className={styles.mediaVideo}
              />
            )}
            {metadata.media.caption && (
              <p className={styles.mediaCaption}>{metadata.media.caption}</p>
            )}
          </div>
        )}
        {metadata?.hasImages && metadata?.images && metadata.images.some((img) => img.data) ? (
          <div className={styles.imageGallery}>
            {metadata.images.map((img, idx) => (
              img.data ? (
                <img
                  key={idx}
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={`Image ${idx + 1}`}
                  className={styles.messageImage}
                  onClick={() => {
                    const win = window.open();
                    if (win) {
                      win.document.write(`<img src="data:${img.mimeType};base64,${img.data}" style="max-width:100%;height:auto;" />`);
                    }
                  }}
                />
              ) : (
                <div key={idx} className={styles.imageIndicator}>
                  <ImageIcon size={14} />
                  <span>{metadata.imageCount === 1 ? t('chat_image_indicator') : `${metadata.imageCount} ${t('chat_images_indicator')}`}</span>
                </div>
              )
            ))}
          </div>
        ) : metadata?.hasImages ? (
          <div className={styles.imageIndicator}>
            <ImageIcon size={14} />
            <span>{metadata.imageCount === 1 ? t('chat_image_indicator') : `${metadata.imageCount} ${t('chat_images_indicator')}`}</span>
          </div>
        ) : null}
        <p className={styles.content}>{content}</p>
        <div className={styles.meta}>
          <span className={styles.time}>{formatTime(createdAt)}</span>
          {role === 'assistant' && (metadata?.tokensUsed || metadata?.toolsCalled?.length) ? (
            <span className={styles.metaInfo}>
              {metadata.latencyMs ? `${(metadata.latencyMs / 1000).toFixed(1)}s` : ''}
              {metadata.tokensUsed ? ` · ${metadata.tokensUsed} tokens` : ''}
              {(() => {
                const visibleTools = (metadata.toolsCalled ?? [])
                  .map((tc) => tc.split('(')[0]?.trim())
                  .filter((tc) => tc && tc !== 'capture_variable');
                return visibleTools.length ? ` · ${visibleTools.join(', ')}` : '';
              })()}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
