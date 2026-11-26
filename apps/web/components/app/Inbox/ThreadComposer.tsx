'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Clock, Mic, Paperclip, Send, Square, User, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { SendPayload } from './useConversationThread';
import styles from './ThreadComposer.module.css';

export interface ThreadComposerProps {
  conversationId: string;
  onSend: (payload: SendPayload) => Promise<boolean>;
  canAttachImage: boolean;
  canRecordVoice: boolean;
  /** WhatsApp con más de 24 horas desde el último mensaje del cliente. */
  windowClosed: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Borradores por conversación mientras dure la sesión (el cuadro se monta de nuevo al cambiar de conversación). */
const drafts = new Map<string, string>();

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
}: ThreadComposerProps) {
  const { t } = useTranslation();
  const [draft, setDraftState] = useState(() => drafts.get(conversationId) ?? '');
  const [image, setImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setDraft = (value: string) => {
    if (value) drafts.set(conversationId, value);
    else drafts.delete(conversationId);
    setDraftState(value);
  };

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

  function submit() {
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

  const canSend = !!draft.trim() || !!image;
  const showMic = canRecordVoice && !canSend;

  return (
    <div className={styles.composer}>
      {windowClosed && (
        <p className={styles.window} role="note">
          <Clock size={15} aria-hidden="true" />
          {t('inbox.composer.whatsappWindow')}
        </p>
      )}
      {image && (
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
        {canAttachImage && (
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
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t('inbox.composer.placeholder')}
            aria-label={t('inbox.composer.label')}
            aria-describedby="inbox-composer-hint"
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
          <button type="button" className={styles.send} onClick={submit} disabled={!canSend} aria-label={t('inbox.composer.send')}>
            <Send size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <p id="inbox-composer-hint" className={styles.hint}>
        <User size={13} aria-hidden="true" />
        {t('inbox.composer.hint')}
      </p>
    </div>
  );
}
