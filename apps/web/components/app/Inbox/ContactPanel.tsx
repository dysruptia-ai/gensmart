'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Megaphone, Plus, Trash2, TriangleAlert, User, X } from 'lucide-react';
import { INBOX_LIMITS } from '@gensmart/shared';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import LabelPicker, { type LabelPickerData } from './LabelPicker';
import { getChannelMeta } from './channelMeta';
import { contactName, formatScore, initialsOf, relativeTime } from './inboxFormat';
import { reasonKey } from './summaryText';
import type { ApiNote, ConversationDetail, HandoffInfo, TimelineEvent } from './types';
import styles from './ContactPanel.module.css';

export interface ContactPanelProps {
  conversation: ConversationDetail | null;
  loading: boolean;
  now: number;
  /** Bajo 1180 px la ficha es un panel con su botón de cerrar. */
  onClose?: () => void;
  /** Cambia cuando llega un puntaje o una conversación nueva del contacto: recarga la actividad. */
  activityKey: number;
  /** web-46: causa y resumen del pedido de ayuda ("Por qué te llegó"). */
  handoff?: HandoffInfo | null;
  /** web-43: notas internas (siempre disponibles, la tenga quien la tenga) y etiquetas. */
  notes?: ApiNote[];
  userId?: string;
  onSaveNote?: (body: string) => Promise<boolean>;
  onAskDeleteNote?: (noteId: string) => void;
  onRemoveLabel?: (labelId: string) => void;
  /** Eventos de esta conversación que también van en Actividad (web-43: "X borró una nota"), con el texto ya armado. */
  threadActivity?: Array<{ id: string; at: string; text: string }>;
  /** El selector de etiquetas, anclado a "+ Agregar". */
  labelPicker?: LabelPickerData;
}

type Tab = 'contact' | 'activity' | 'notes';
const TABS: Tab[] = ['contact', 'activity', 'notes'];

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

export default function ContactPanel({
  conversation: c,
  loading,
  now,
  handoff,
  onClose,
  activityKey,
  notes = [],
  userId,
  onSaveNote,
  onAskDeleteNote,
  onRemoveLabel,
  labelPicker,
  threadActivity,
}: ContactPanelProps) {
  const { t, language } = useTranslation();
  const baseId = useId();
  const [tab, setTab] = useState<Tab>('contact');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ contact: null, activity: null, notes: null });
  // web-43: el selector se abre para una conversación; la nota nueva, igual
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const addLabelRef = useRef<HTMLButtonElement>(null);
  const closePicker = useCallback(() => {
    setPickerFor(null);
    addLabelRef.current?.focus();
  }, []);
  const [newNote, setNewNote] = useState<{ id: string | null; text: string }>({ id: null, text: '' });
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'error'>('idle');
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
  // "Necesitan a alguien": pidió ayuda y nadie la tomó
  const needsSomeone = c.handoffActive && !c.takenOverBy && c.status !== 'closed';
  const whyReason = reasonKey(handoff?.reason);
  const ad = readReferral(c.channelMetadata);
  // Mientras llega la versión nueva se sigue viendo la anterior del mismo contacto
  const sameContact = !!timeline && !!contactId && timeline.key.startsWith(`${contactId}:`);
  const contactEvents = sameContact ? timeline.events : null;
  const events: TimelineEvent[] | null = contactEvents
    ? [
        ...contactEvents,
        ...(threadActivity ?? []).map((e) => ({ type: 'thread_event', description: e.text, date: e.at, metadata: { conversationId: c.id } })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : null;
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
            {key === 'notes' && notes.length > 0
              ? t('inbox.contact.tabs.notesCount', { count: notes.length })
              : t(`inbox.contact.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'contact' ? (
        <div role="tabpanel" id={`${baseId}-panel-contact`} aria-labelledby={`${baseId}-tab-contact`} className={styles.scroll}>
          {needsSomeone && (
            <div className={`${styles.section} ${styles.whySection}`}>
              <h3 className={`${styles.heading} ${styles.whyHeading}`}>
                <TriangleAlert size={12} aria-hidden="true" />
                {t('inbox.contact.why')}
              </h3>
              <p className={styles.whyText}>
                {whyReason === 'agent_paused'
                  ? t('inbox.contact.whyPaused')
                  : whyReason
                  ? t('inbox.thread.events.handoffWhy', { cause: t(`inbox.handoffCause.${whyReason}`) })
                  : t('inbox.thread.events.handoff')}
              </p>
              {handoff?.teamSummary && <p className={styles.whySummary}>{handoff.teamSummary}</p>}
            </div>
          )}
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

          <div className={styles.section}>
            <h3 className={styles.heading}>{t('inbox.labels.title')}</h3>
            <div className={styles.labels}>
              {(c.labels ?? []).map((label) => (
                <span key={label.id} className={styles.label}>
                  <span className={styles.labelName}>{label.name}</span>
                  {onRemoveLabel && (
                    <button
                      type="button"
                      className={styles.labelRemove}
                      onClick={() => onRemoveLabel(label.id)}
                      aria-label={t('inbox.labels.remove', { name: label.name })}
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))}
              {!c.labels?.length && <span className={styles.noteInline}>{t('inbox.labels.none')}</span>}
              {labelPicker && (
                <span className={styles.addWrap}>
                  <button
                    ref={addLabelRef}
                    type="button"
                    className={styles.addLabel}
                    onClick={() => setPickerFor(pickerFor === c.id ? null : c.id)}
                    aria-expanded={pickerFor === c.id}
                  >
                    <Plus size={11} aria-hidden="true" />
                    {t('inbox.labels.addShort')}
                  </button>
                  {pickerFor === c.id && <LabelPicker {...labelPicker} onClose={closePicker} direction="up" />}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : tab === 'notes' ? (
        <div role="tabpanel" id={`${baseId}-panel-notes`} aria-labelledby={`${baseId}-tab-notes`} className={styles.scroll}>
          <div className={styles.section}>
            <h3 className={styles.heading}>{t('inbox.notes.teamNotes')}</h3>
            {notes.length === 0 ? (
              <p className={styles.note}>{t('inbox.notes.empty')}</p>
            ) : (
              <ul className={styles.notes}>
                {[...notes].reverse().map((n) => (
                  <li key={n.id} className={styles.noteItem}>
                    <p className={styles.noteBody}>{n.body}</p>
                    <span className={styles.noteMeta}>
                      {n.authorUserId && n.authorUserId === userId ? t('inbox.row.you') : n.authorName || t('inbox.row.team')} ·{' '}
                      <time dateTime={n.createdAt}>{relativeTime(n.createdAt, language, now)}</time>
                    </span>
                    {n.canDelete && onAskDeleteNote && (
                      <button
                        type="button"
                        className={styles.noteDelete}
                        onClick={() => onAskDeleteNote(n.id)}
                        aria-label={t('inbox.notes.delete')}
                        title={t('inbox.notes.delete')}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {onSaveNote && (
              <form
                className={styles.newNote}
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = (newNote.id === c.id ? newNote.text : '').trim();
                  if (!body || noteState === 'saving') return;
                  setNoteState('saving');
                  void onSaveNote(body).then((ok) => {
                    setNoteState(ok ? 'idle' : 'error');
                    if (ok) setNewNote({ id: c.id, text: '' });
                  });
                }}
              >
                <label className={styles.newNoteLabel} htmlFor={`${baseId}-new-note`}>
                  {t('inbox.notes.newNote')}
                </label>
                <textarea
                  id={`${baseId}-new-note`}
                  className={styles.newNoteInput}
                  value={newNote.id === c.id ? newNote.text : ''}
                  onChange={(e) => {
                    setNewNote({ id: c.id, text: e.target.value });
                    if (noteState === 'error') setNoteState('idle');
                  }}
                  placeholder={t('inbox.notes.panelPlaceholder')}
                  maxLength={INBOX_LIMITS.noteMaxChars}
                  aria-describedby={`${baseId}-note-count`}
                />
                <span id={`${baseId}-note-count`} className={styles.counter}>
                  {t('inbox.notes.counter', {
                    count: [...(newNote.id === c.id ? newNote.text : '')].length.toLocaleString(language === 'es' ? 'es-CO' : 'en-US'),
                    max: INBOX_LIMITS.noteMaxChars.toLocaleString(language === 'es' ? 'es-CO' : 'en-US'),
                  })}
                </span>
                {noteState === 'error' && (
                  <p className={styles.noteError} role="alert">
                    {t('inbox.notes.saveError')}
                  </p>
                )}
                <InboxButton
                  type="submit"
                  loading={noteState === 'saving'}
                  disabled={!(newNote.id === c.id ? newNote.text : '').trim()}
                  className={styles.saveNote}
                >
                  {t('inbox.notes.save')}
                </InboxButton>
              </form>
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
