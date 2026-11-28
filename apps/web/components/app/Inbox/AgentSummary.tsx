'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { handoffIsCurrent, summaryLead, variableChips } from './summaryText';
import type { AiAccess, AiSummary, ConversationDetail, HandoffInfo } from './types';
import styles from './AgentSummary.module.css';

export interface AgentSummaryProps {
  conversation: ConversationDetail;
  handoff: HandoffInfo | null;
  aiSummary: AiSummary | null;
  ai: AiAccess | null;
  /** Para saber si el pedido de ayuda sigue vigente. */
  events: Array<{ kind: string; at: string }>;
  /** Quien mira: si la tiene, "La tienes tú". */
  userId?: string | null;
}

/** Lo que espera al resumen con IA antes de quitar el esqueleto (sin mensaje de error). */
const SKELETON_MS = 30_000;

/**
 * "Resumen del agente" (web-46, `.aisum` del diseño): la primera frase sin modelo (todos los planes),
 * después el team_summary del pedido de ayuda vigente o el resumen con IA, y hasta tres variables.
 */
export default function AgentSummary({ conversation: c, handoff, aiSummary, ai, events, userId }: AgentSummaryProps) {
  const { t, language } = useTranslation();
  const textRef = useRef<HTMLParagraphElement>(null);
  // Abierto y "ya esperó" van con su clave: al cambiar de conversación o de pedido de ayuda se reinician solos
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const expanded = expandedFor === c.id;
  const setExpanded = (open: boolean) => setExpandedFor(open ? c.id : null);
  const [overflows, setOverflows] = useState(false);
  const [waitedFor, setWaitedFor] = useState<string | null>(null);

  const current = handoffIsCurrent(
    handoff,
    events.map((e) => ({ type: e.kind === 'handoff' ? 'handoff_requested' : e.kind, createdAt: e.at })),
  );
  const extra = current ? (handoff?.teamSummary ?? aiSummary?.text ?? null) : null;
  const waited = !!handoff && waitedFor === handoff.eventId;
  const generating =
    current && !handoff?.teamSummary && !aiSummary && !!ai?.enabled && ai.planAllows && !ai.limitReached && !waited;
  const lead = summaryLead({ conversation: c, handoffReason: current ? (handoff?.reason ?? null) : null, userId }, t);
  const chips = variableChips(c.capturedVariables);
  const score = c.aiScore ?? c.contact?.aiScore ?? null;

  // El esqueleto se quita solo a los 30 s si no llegó el resumen
  const eventId = handoff?.eventId ?? null;
  useEffect(() => {
    if (!eventId) return;
    const id = window.setTimeout(() => setWaitedFor(eventId), SKELETON_MS);
    return () => window.clearTimeout(id);
  }, [eventId]);

  // "Ver más" solo si el texto pasa de dos líneas
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lead, extra, expanded]);

  const locale = language === 'es' ? 'es-CO' : 'en-US';
  return (
    <section className={styles.aisum} aria-label={t('inbox.summary.title')}>
      <span className={styles.label}>
        <Sparkles size={13} aria-hidden="true" />
        {t('inbox.summary.title')}
      </span>
      <div className={styles.main}>
        <p ref={textRef} id={`aisum-${c.id}`} className={`${styles.text} ${expanded ? styles.open : ''}`}>
          {lead}
          {extra && <> {extra}</>}
        </p>
        {generating && <span className={styles.skeleton} aria-busy="true" aria-label={t('inbox.summary.loading')} />}
        {chips.length > 0 && (
          <div className={styles.chips}>
            {chips.map((chip) => (
              <span key={chip} className={styles.chip}>
                {chip}
              </span>
            ))}
          </div>
        )}
        {(overflows || expanded) && (
          <button
            type="button"
            className={styles.more}
            aria-expanded={expanded}
            aria-controls={`aisum-${c.id}`}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? t('inbox.summary.less') : t('inbox.summary.more')}
          </button>
        )}
      </div>
      {score !== null && (
        <span className={styles.score}>
          {t('inbox.summary.score', {
            score: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(score),
          })}
        </span>
      )}
    </section>
  );
}
