'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Megaphone, User, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import { getChannelMeta } from './channelMeta';
import { contactName, formatScore, initialsOf, relativeTime } from './inboxFormat';
import type { ConversationDetail, TimelineEvent } from './types';
import styles from './ContactPanel.module.css';

export interface ContactPanelProps {
  conversation: ConversationDetail | null;
  loading: boolean;
  now: number;
  /** Bajo 1180 px la ficha es un panel con su botón de cerrar. */
  onClose?: () => void;
  /** Cambia cuando llega un puntaje o una conversación nueva del contacto: recarga la actividad. */
  activityKey: number;
}

type Tab = 'contact' | 'activity';
const TABS: Tab[] = ['contact', 'activity'];

function readable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

interface AdReferral {
  headline: string | null;
  body: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  videoUrl: string | null;
}

/** Solo enlaces http(s): lo demás (javascript:, data:) no se muestra. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** El anuncio de Meta (Click-to-WhatsApp) que guarda el webhook en `channel_metadata.referral`. */
function readReferral(metadata: Record<string, unknown> | undefined): AdReferral | null {
  const raw = metadata?.['referral'];
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ad: AdReferral = {
    headline: text(r['headline']),
    body: text(r['body']),
    imageUrl: safeUrl(r['image_url']) ?? safeUrl(r['thumbnail_url']),
    sourceUrl: safeUrl(r['source_url']),
    videoUrl: safeUrl(r['video_url']),
  };
  return Object.values(ad).some(Boolean) ? ad : null;
}

export default function ContactPanel({ conversation: c, loading, now, onClose, activityKey }: ContactPanelProps) {
  const { t, language } = useTranslation();
  const baseId = useId();
  const [tab, setTab] = useState<Tab>('contact');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ contact: null, activity: null });
  // Resultado de la actividad, atado al contacto y a la versión que se pidió
  const [timeline, setTimeline] = useState<{ key: string; events: TimelineEvent[] | null } | null>(null);

  const contactId = c?.contact?.id ?? null;

  // La actividad se pide al abrir la pestaña (y otra vez si cambia el contacto o llega algo nuevo)
  useEffect(() => {
    if (tab !== 'activity' || !contactId) return;
    let alive = true;
    const key = `${contactId}:${activityKey}`;
    api
      .get<{ events: TimelineEvent[] }>(`/api/contacts/${contactId}/timeline`)
      .then((data) => {
        if (alive) setTimeline({ key, events: data.events });
      })
      .catch(() => {
        if (alive) setTimeline({ key, events: null });
      });
    return () => {
      alive = false;
    };
  }, [tab, contactId, activityKey]);

  function onTabKey(e: React.KeyboardEvent) {
    const index = TABS.indexOf(tab);
    let next: Tab | null = null;
    if (e.key === 'ArrowRight') next = TABS[(index + 1) % TABS.length]!;
    if (e.key === 'ArrowLeft') next = TABS[(index - 1 + TABS.length) % TABS.length]!;
    if (e.key === 'Home') next = TABS[0]!;
    if (e.key === 'End') next = TABS[TABS.length - 1]!;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const header = (
    <div className={styles.sheetHead}>
      <span>{t('inbox.contact.title')}</span>
      {onClose && (
        <InboxButton variant="icon" icon={X} onClick={onClose} aria-label={t('inbox.contact.close')} />
      )}
    </div>
  );

  if (loading || !c) {
    return (
      <aside className={styles.panel} aria-label={t('inbox.contact.title')} aria-busy={loading || undefined}>
        {header}
        {loading && (
          <div className={styles.section} aria-hidden="true">
            <i className={`${styles.sk} ${styles.skAvatar}`} />
            <i className={`${styles.sk} ${styles.skLine}`} />
            <i className={`${styles.sk} ${styles.skLine}`} />
            <i className={`${styles.sk} ${styles.skBlock}`} />
          </div>
        )}
      </aside>
    );
  }

  const contact = c.contact;
  const name = contactName(contact, t('inbox.row.unknownContact'));
  const initials = initialsOf(contact?.name ?? '');
  const channel = getChannelMeta(c.channel);
  const score = contact?.aiScore ?? c.aiScore;
  const scoreText = formatScore(score);
  const variables = Object.entries(c.capturedVariables ?? {}).filter(
    ([, v]) => readable(v) !== '',
  );
  const stage = contact?.funnelStage;
  const ad = readReferral(c.channelMetadata);
  // Mientras llega la versión nueva se sigue viendo la anterior del mismo contacto
  const sameContact = !!timeline && !!contactId && timeline.key.startsWith(`${contactId}:`);
  const events = sameContact ? timeline.events : null;
  const timelineError = sameContact && timeline.key === `${contactId}:${activityKey}` && timeline.events === null;

  return (
    <aside className={styles.panel} aria-label={t('inbox.contact.title')}>
      {header}
      <div className={styles.tabs} role="tablist" aria-label={t('inbox.contact.title')} onKeyDown={onTabKey}>
        {TABS.map((key) => (
          <button
            key={key}
            ref={(el) => {
              tabRefs.current[key] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`${baseId}-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            className={styles.tab}
            onClick={() => setTab(key)}
          >
            {t(`inbox.contact.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'contact' ? (
        <div role="tabpanel" id={`${baseId}-panel-contact`} aria-labelledby={`${baseId}-tab-contact`} className={styles.scroll}>
          <div className={styles.section}>
            <div className={styles.who}>
              <span className={styles.avatar} aria-hidden="true">
                {contact?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contact.avatarUrl} alt="" />
                ) : initials ? (
                  initials
                ) : (
                  <User size={18} />
                )}
              </span>
              <span className={styles.whoText}>
                <b>{name}</b>
                <span>{channel.label}</span>
              </span>
            </div>
            <dl className={styles.kv}>
              <div>
                <dt>{t('inbox.contact.phone')}</dt>
                <dd>{contact?.phone || '—'}</dd>
              </div>
              <div>
                <dt>{t('inbox.contact.email')}</dt>
                <dd>{contact?.email || '—'}</dd>
              </div>
              <div>
                <dt>{t('inbox.contact.channel')}</dt>
                <dd>{channel.label}</dd>
              </div>
              <div>
                <dt>{t('inbox.contact.agent')}</dt>
                <dd>{c.agentName || '—'}</dd>
              </div>
            </dl>
            {contact ? (
              <Link href={`/dashboard/contacts/${contact.id}`} className={styles.link}>
                <ExternalLink size={14} aria-hidden="true" />
                {t('inbox.contact.viewContact')}
              </Link>
            ) : (
              <p className={styles.note}>{t('inbox.contact.noContact')}</p>
            )}
          </div>

          {ad && (
            <div className={styles.section}>
              <h3 className={`${styles.heading} ${styles.adHeading}`}>
                <Megaphone size={14} aria-hidden="true" />
                {t('inbox.contact.adTitle')}
              </h3>
              <div className={styles.ad}>
                {ad.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.imageUrl} alt={ad.headline ?? t('inbox.contact.adImage')} className={styles.adImage} loading="lazy" />
                )}
                {ad.headline && <b className={styles.adHeadline}>{ad.headline}</b>}
                {ad.body && <p className={styles.adBody}>{ad.body}</p>}
                {(ad.sourceUrl || ad.videoUrl) && (
                  <span className={styles.adLinks}>
                    {ad.sourceUrl && (
                      <a href={ad.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        <ExternalLink size={14} aria-hidden="true" />
                        {t('inbox.contact.adLink')}
                      </a>
                    )}
                    {ad.videoUrl && (
                      <a href={ad.videoUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        <ExternalLink size={14} aria-hidden="true" />
                        {t('inbox.contact.adVideo')}
                      </a>
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className={styles.section}>
            <h3 className={styles.heading}>{t('inbox.contact.lead')}</h3>
            {scoreText ? (
              <div className={styles.meter}>
                <span className={styles.meterNum}>{scoreText}</span>
                <span className={styles.meterBar} aria-hidden="true">
                  <i style={{ width: `${Math.max(0, Math.min(10, Number(score))) * 10}%` }} />
                </span>
                <span className="gsSr">{t('inbox.contact.scoreSr', { score: scoreText })}</span>
              </div>
            ) : (
              <p className={styles.note}>{t('inbox.contact.noScore')}</p>
            )}
            <dl className={styles.kv}>
              <div>
                <dt>{t('inbox.contact.service')}</dt>
                <dd>{contact?.aiService || '—'}</dd>
              </div>
              <div>
                <dt>{t('inbox.contact.stage')}</dt>
                <dd>{stage ? t(`inbox.contact.stages.${stage}`) : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.section}>
            <h3 className={styles.heading}>{t('inbox.contact.variables')}</h3>
            {variables.length ? (
              <dl className={styles.kv}>
                {variables.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd title={readable(value)}>{readable(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.note}>{t('inbox.contact.noVariables')}</p>
            )}
          </div>
        </div>
      ) : (
        <div role="tabpanel" id={`${baseId}-panel-activity`} aria-labelledby={`${baseId}-tab-activity`} className={styles.scroll}>
          <div className={styles.section}>
            <h3 className={styles.heading}>{t('inbox.contact.timeline')}</h3>
            {!contactId ? (
              <p className={styles.note}>{t('inbox.contact.noContact')}</p>
            ) : timelineError ? (
              <p className={styles.note} role="alert">
                {t('inbox.contact.timelineError')}
              </p>
            ) : !events ? (
              <div aria-hidden="true">
                <i className={`${styles.sk} ${styles.skLine}`} />
                <i className={`${styles.sk} ${styles.skLine}`} />
              </div>
            ) : events.length === 0 ? (
              <p className={styles.note}>{t('inbox.contact.noActivity')}</p>
            ) : (
              <ul className={styles.timeline}>
                {events.map((event, i) => {
                  const isThis = event.metadata?.['conversationId'] === c.id;
                  const ch = typeof event.metadata?.['channel'] === 'string' ? getChannelMeta(event.metadata['channel']).label : '';
                  const known = event.type === 'conversation_started' || event.type === 'conversation_closed';
                  return (
                    <li key={`${event.type}-${event.date}-${i}`} className={event.type === 'conversation_closed' ? styles.tlClosed : styles.tlStart}>
                      {known ? t(`inbox.contact.events.${event.type}`, { channel: ch }) : event.description}
                      {isThis && <span className={styles.tlThis}>{t('inbox.contact.thisConversation')}</span>}
                      <time dateTime={event.date}>{relativeTime(event.date, language, now)}</time>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
