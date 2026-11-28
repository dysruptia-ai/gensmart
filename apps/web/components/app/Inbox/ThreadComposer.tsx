'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Clock, Lock, Mic, Paperclip, Send, Sparkles, Square, User, X } from 'lucide-react';
import Link from 'next/link';
import { INBOX_AI, INBOX_LIMITS } from '@gensmart/shared';
import { useTranslation } from '@/hooks/useTranslation';
import QuickReplyMenu, { optionId } from './QuickReplyMenu';
import {
  applyReplyVariables,
  filterQuickReplies,
  findSlashToken,
  insertReply,
  topReplies,
  type MenuMatch,
  type QuickReply,
  type SlashToken,
} from './quickReplies';
import type { SendPayload } from './useConversationThread';
import type { SuggestionsState } from './useSuggestions';
import styles from './ThreadComposer.module.css';

export type ComposerMode = 'reply' | 'note';

export interface ThreadComposerProps {
  conversationId: string;
  onSend: (payload: SendPayload) => Promise<boolean>;
  canAttachImage: boolean;
  canRecordVoice: boolean;
  /** WhatsApp con más de 24 horas desde el último mensaje del cliente. */
  windowClosed: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Nota interna (web-43): se guarda, no sale por el canal. */
  onSaveNote: (body: string) => Promise<boolean>;
  /** Respuestas rápidas de la organización (null mientras cargan). */
  quickReplies: QuickReply[] | null;
  onUseReply: (id: string) => void;
  contactName: string | null;
  /** Quien escribe ({agente}). */
  agentName: string | null;
  isManager: boolean;
  /** web-46: respuestas sugeridas para el último mensaje del cliente (solo en Responder). */
  suggestions?: SuggestionsState;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Borradores por conversación y por pestaña (respuesta y nota) mientras dure la sesión: el cuadro
 * se monta de nuevo al cambiar de conversación.
 */
const drafts = new Map<string, string>();
const draftKey = (conversationId: string, mode: ComposerMode) => `${conversationId}:${mode}`;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Cuadro para responder (solo si la conversación la tomaste tú). Enter envía; Shift+Enter, salto de línea.
 * Se monta con `key={conversationId}`: la imagen pendiente y la grabación no pasan a otra conversación.
 */
export default function ThreadComposer({
  conversationId,
  onSend,
  canAttachImage,
  canRecordVoice,
  windowClosed,
  textareaRef,
  onSaveNote,
  quickReplies,
  onUseReply,
  contactName,
  agentName,
  isManager,
  suggestions,
}: ThreadComposerProps) {
  const { t, language } = useTranslation();
  const menuId = useId();
  // Al cambiar de conversación el cuadro se vuelve a montar y empieza en "Responder"
  const [mode, setMode] = useState<ComposerMode>('reply');
  const [draft, setDraftState] = useState(() => drafts.get(draftKey(conversationId, 'reply')) ?? '');
  // Menú de "/": la ficha que se está escribiendo (o la que abrió el chip "Todas")
  const [token, setToken] = useState<(SlashToken & { forced?: boolean }) | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [savingNote, setSavingNote] = useState(false);
  const [image, setImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const note = mode === 'note';
  const replies = useMemo(() => quickReplies ?? [], [quickReplies]);
  const vars = useMemo(() => ({ contactName, agentName, language }), [contactName, agentName, language]);

  const setDraft = (value: string, forMode: ComposerMode = mode) => {
    const key = draftKey(conversationId, forMode);
    if (value) drafts.set(key, value);
    else drafts.delete(key);
    setDraftState(value);
  };

  function switchMode(next: ComposerMode) {
    if (next === mode) return;
    setMode(next);
    setDraftState(drafts.get(draftKey(conversationId, next)) ?? '');
    setToken(null);
    setProblem(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  // ── menú de "/" ──
  const matches: MenuMatch[] = useMemo(() => (token ? filterQuickReplies(replies, token.query) : []), [token, replies]);
  const orgHasNone = quickReplies !== null && replies.length === 0;
  // Sin coincidencias el menú se cierra; sin respuestas en la organización se muestra el vacío
  const menuOpen = !note && !!token && token.start !== dismissed && (matches.length > 0 || orgHasNone);
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));

  function readToken(el: HTMLTextAreaElement) {
    if (note) return setToken(null);
    const caret = el.selectionStart ?? el.value.length;
    const next = el.selectionStart === el.selectionEnd ? findSlashToken(el.value, caret) : null;
    setToken((prev) => {
      if (!next) return prev?.forced && prev.start === caret ? prev : null;
      if (prev && prev.start === next.start && prev.query === next.query && !prev.forced) return prev;
      return next;
    });
    if (!next || next.start !== dismissed) setDismissed(null);
    setActive(0);
  }

  function insertAt(body: string, at: { start: number; end: number }) {
    const el = textareaRef.current;
    const text = applyReplyVariables(body, vars);
    const result = insertReply(draft, { start: at.start, query: '' }, at.end, text);
    setDraft(result.text);
    setToken(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(result.caret, result.caret);
    });
  }

  function pick(match: MenuMatch) {
    if (!token) return;
    const el = textareaRef.current;
    const caret = token.forced ? token.start : (el?.selectionStart ?? token.start + token.query.length + 1);
    insertAt(match.reply.body, { start: token.start, end: caret });
    onUseReply(match.reply.id);
  }

  function pickChip(reply: QuickReply) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const before = draft.slice(0, caret);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    const text = applyReplyVariables(reply.body, vars);
    const next = before + pad + text + draft.slice(caret);
    setDraft(next);
    setToken(null);
    const pos = (before + pad + text).length;
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
    onUseReply(reply.id);
  }

  /** Sugerida (web-46): se inserta en el cursor, como un chip; nunca reemplaza el borrador ni se envía sola. */
  function pickSuggestion(body: string) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? caret;
    const before = draft.slice(0, caret);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    const result = insertReply(draft, { start: caret, query: '' }, end, pad + body);
    setDraft(result.text);
    setToken(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(result.caret, result.caret);
    });
  }

  function openAll() {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? draft.length;
    setDismissed(null);
    setActive(0);
    setToken({ start: caret, query: '', forced: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  // Al desmontar (otra conversación o se devolvió) se para la grabación sin enviarla
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
      recorderRef.current = null;
    },
    [],
  );

  // El cuadro crece con el texto hasta 6 líneas
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft, textareaRef]);

  async function saveNote() {
    const body = draft.trim();
    if (!body || savingNote) return;
    if ([...body].length > INBOX_LIMITS.noteMaxChars) return setProblem(t('inbox.notes.tooLong'));
    setSavingNote(true);
    setProblem(null);
    setDraft('', 'note');
    const ok = await onSaveNote(body);
    setSavingNote(false);
    if (!ok) {
      setDraft(body, 'note');
      setProblem(t('inbox.notes.saveError'));
    }
  }

  function submit() {
    if (note) return void saveNote();
    const content = draft.trim();
    if (!content && !image) return;
    const payload: SendPayload = { content, ...(image ? { image: { data: image.data, mimeType: image.mimeType } } : {}) };
    setDraft('');
    setImage(null);
    void onSend(payload);
  }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setProblem(t('inbox.composer.imageType'));
    if (file.size > MAX_IMAGE_BYTES) return setProblem(t('inbox.composer.imageSize'));
    setProblem(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setImage({ data: url.split(',')[1] ?? '', mimeType: file.type, preview: url });
    };
    reader.readAsDataURL(file);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        setSeconds(0);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const data = toBase64(await blob.arrayBuffer());
        void onSend({ content: '', audio: { data, mimeType: blob.type || 'audio/webm' } });
      };
      recorder.start();
      recorderRef.current = recorder;
      setProblem(null);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setProblem(t('inbox.composer.micError'));
    }
  }

  const canSend = !!draft.trim() || (!note && !!image);
  const showMic = !note && canRecordVoice && !canSend;
  const chips = note ? [] : topReplies(replies);
  const placeholder = note
    ? t('inbox.notes.placeholder')
    : replies.length > 0
      ? t('inbox.quickReplies.placeholder')
      : t('inbox.composer.placeholder');

  return (
    <div className={`${styles.composer} ${note ? styles.noteMode : ''}`}>
      <div className={styles.tabs}>
        <button type="button" className={styles.tab} aria-pressed={!note} onClick={() => switchMode('reply')}>
          {t('inbox.notes.tabReply')}
        </button>
        <button type="button" className={styles.tab} aria-pressed={note} onClick={() => switchMode('note')}>
          <Lock size={12} aria-hidden="true" />
          {t('inbox.notes.tabNote')}
        </button>
      </div>
      {menuOpen && token && (
        <QuickReplyMenu
          id={menuId}
          query={token.query}
          matches={matches}
          active={activeIndex}
          empty={orgHasNone}
          vars={vars}
          isManager={isManager}
          onPick={pick}
          onHover={setActive}
        />
      )}
      {!note && windowClosed && (
        <p className={styles.window} role="note">
          <Clock size={15} aria-hidden="true" />
          {t('inbox.composer.whatsappWindow')}
        </p>
      )}
      {!note && suggestions?.kind === 'loading' && (
        <div className={styles.suggestions} role="group" aria-label={t('inbox.suggestions.group')} aria-busy="true">
          <div className={styles.suggestionsHead}>
            <span className={styles.suggestionsLabel}>
              <Sparkles size={12} aria-hidden="true" />
              {t('inbox.suggestions.label')}
            </span>
          </div>
          <div className={styles.suggestionsGrid}>
            {Array.from({ length: INBOX_AI.suggestionsCount }, (_, i) => (
              <span key={i} className={styles.suggestionSkeleton} aria-hidden="true" />
            ))}
          </div>
          <span className="gsSr">{t('inbox.suggestions.loading')}</span>
        </div>
      )}
      {!note && suggestions?.kind === 'ready' && suggestions.items.length > 0 && (
        <div className={styles.suggestions} role="group" aria-label={t('inbox.suggestions.group')}>
          <div className={styles.suggestionsHead}>
            <span className={styles.suggestionsLabel} aria-hidden="true">
              <Sparkles size={12} aria-hidden="true" />
              {t('inbox.suggestions.label')}
            </span>
            <span className={styles.suggestionsNote}>{t('inbox.suggestions.note', { count: INBOX_AI.messagesPerGeneration })}</span>
          </div>
          <div className={styles.suggestionsGrid}>
            {suggestions.items.map((text) => (
              <button key={text} type="button" className={styles.suggestion} title={text} onClick={() => pickSuggestion(text)}>
                <span className={styles.suggestionText}>{text}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!note && suggestions?.kind === 'limit' && (
        <p className={styles.suggestionsNote}>
          {t('inbox.suggestions.limit')}{' '}
          <Link href="/dashboard/billing" className={styles.suggestionsLink}>
            {t('inbox.suggestions.limitLink')}
          </Link>
        </p>
      )}
      {!note && chips.length > 0 && (
        <div className={styles.chips}>
          {chips.map((reply) => (
            <button key={reply.id} type="button" className={styles.chip} title={reply.body} onClick={() => pickChip(reply)}>
              /{reply.shortcut}
            </button>
          ))}
          <button type="button" className={styles.chip} onClick={openAll} aria-label={t('inbox.quickReplies.allAria')}>
            {t('inbox.quickReplies.all')} <kbd>/</kbd>
          </button>
        </div>
      )}
      {!note && image && (
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.preview} alt={t('inbox.composer.imagePreview')} />
          <button type="button" onClick={() => setImage(null)} aria-label={t('inbox.composer.removeImage')}>
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}
      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}
      <div className={styles.bar}>
        {!note && canAttachImage && (
          <>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} className={styles.file} tabIndex={-1} />
            <button
              type="button"
              className={styles.tool}
              onClick={() => fileRef.current?.click()}
              disabled={recording}
              aria-label={t('inbox.composer.attachImage')}
              title={t('inbox.composer.attachImage')}
            >
              <Paperclip size={17} aria-hidden="true" />
            </button>
          </>
        )}
        {recording ? (
          <span className={styles.recording} role="status">
            <span className={styles.recDot} aria-hidden="true" />
            {t('inbox.composer.recording', { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` })}
          </span>
        ) : (
          <textarea
            ref={textareaRef}
            className={styles.input}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              readToken(e.target);
            }}
            onSelect={(e) => readToken(e.currentTarget)}
            onBlur={() => setToken(null)}
            onKeyDown={(e) => {
              if (menuOpen && matches.length > 0) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const n = matches.length;
                  setActive((activeIndex + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
                  return;
                }
                if ((e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) || e.key === 'Tab') {
                  e.preventDefault();
                  const m = matches[activeIndex];
                  if (m) pick(m);
                  return;
                }
              }
              if (menuOpen && e.key === 'Escape') {
                // Cierra el menú y deja el texto (no cierra nada más)
                e.preventDefault();
                e.stopPropagation();
                setDismissed(token?.start ?? null);
                if (token?.forced) setToken(null);
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            aria-label={note ? t('inbox.notes.label') : t('inbox.composer.label')}
            aria-describedby="inbox-composer-hint"
            maxLength={note ? INBOX_LIMITS.noteMaxChars : undefined}
            role={note ? undefined : 'combobox'}
            aria-autocomplete={note ? undefined : 'list'}
            aria-expanded={note ? undefined : menuOpen}
            aria-controls={note ? undefined : menuOpen && !orgHasNone ? menuId : undefined}
            aria-activedescendant={menuOpen && matches.length > 0 ? optionId(menuId, activeIndex) : undefined}
          />
        )}
        {showMic || recording ? (
          <button
            type="button"
            className={`${styles.send} ${recording ? styles.stop : ''}`}
            onClick={recording ? () => recorderRef.current?.stop() : () => void startRecording()}
            aria-label={recording ? t('inbox.composer.stopRecording') : t('inbox.composer.recordVoice')}
          >
            {recording ? <Square size={15} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
          </button>
        ) : (
          <button
            type="button"
            className={styles.send}
            onClick={submit}
            disabled={!canSend || savingNote}
            aria-label={note ? t('inbox.notes.save') : t('inbox.composer.send')}
            title={note ? t('inbox.notes.save') : undefined}
          >
            <Send size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <p id="inbox-composer-hint" className={styles.hint}>
        {note ? <Lock size={13} aria-hidden="true" /> : <User size={13} aria-hidden="true" />}
        {note ? t('inbox.notes.hint') : t('inbox.composer.hint')}
      </p>
    </div>
  );
}
