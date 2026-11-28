/**
 * "Resumen del agente" (web-46): la parte que no usa el modelo (todos los planes) y qué resumen
 * mostrar después de ella.
 */
import type { ConversationDetail, HandoffInfo, HandoffReason } from './types';

type T = (key: string, values?: Record<string, string | number>) => string;

/** Causa con texto propio; `other` y los eventos viejos sin causa van sin ella. */
export function reasonKey(reason: HandoffReason | null | undefined): Exclude<HandoffReason, 'other'> | null {
  return reason && reason !== 'other' ? reason : null;
}

export type SummaryState = 'needs' | 'taken' | 'closed' | 'agent';

export function summaryState(c: Pick<ConversationDetail, 'status' | 'handoffActive' | 'takenOverBy'>): SummaryState {
  if (c.status === 'closed') return 'closed';
  if (c.status === 'human_takeover' || c.takenOverBy) return 'taken';
  if (c.handoffActive) return 'needs';
  return 'agent';
}

export interface LeadInput {
  conversation: Pick<ConversationDetail, 'status' | 'handoffActive' | 'takenOverBy' | 'takeoverUserName' | 'closedOutcome'> & {
    contact: { funnelStage: string | null } | null;
  };
  handoffReason: HandoffReason | null;
  /** Quien mira: si la tiene, "La tienes tú". */
  userId?: string | null;
}

/** Primera frase, sin modelo, según el estado; y la etapa del embudo si la hay. */
export function summaryLead({ conversation: c, handoffReason, userId }: LeadInput, t: T): string {
  const state = summaryState(c);
  let lead: string;
  if (state === 'needs') {
    const r = reasonKey(handoffReason);
    lead = r ? t(`inbox.summary.because.${r}`) : t('inbox.summary.needs');
  } else if (state === 'taken') {
    lead =
      userId && c.takenOverBy === userId
        ? t('inbox.summary.takenYou')
        : c.takeoverUserName
          ? t('inbox.summary.takenBy', { name: c.takeoverUserName })
          : t('inbox.summary.taken');
  } else if (state === 'closed') {
    lead = c.closedOutcome
      ? t('inbox.summary.closedAs', { outcome: t(`inbox.outcomes.${c.closedOutcome}`) })
      : t('inbox.summary.closed');
  } else {
    lead = t('inbox.summary.agent');
  }
  const stage = c.contact?.funnelStage;
  return stage ? `${lead} ${t('inbox.summary.stage', { stage: t(`inbox.contact.stages.${stage}`) })}` : lead;
}

interface EventLike {
  type: string;
  createdAt: string;
}

/**
 * El pedido de ayuda sigue vigente si nada lo dejó atrás: ni la devolvieron al agente ni se reabrió
 * después. Un resumen de un pedido viejo no se muestra en una conversación que siguió.
 */
export function handoffIsCurrent(handoff: Pick<HandoffInfo, 'requestedAt'> | null | undefined, events: EventLike[]): boolean {
  if (!handoff) return false;
  const at = new Date(handoff.requestedAt).getTime();
  return !events.some(
    (e) => (e.type === 'released' || e.type === 'reopened' || e.type === 'handoff_requested') && new Date(e.createdAt).getTime() > at
  );
}

/** Hasta tres variables capturadas como "clave: valor" con el valor recortado. */
export function variableChips(vars: Record<string, unknown> | null | undefined, max = 3, valueMax = 40): string[] {
  const out: string[] = [];
  for (const [key, raw] of Object.entries(vars ?? {})) {
    if (raw === null || raw === undefined || raw === '') continue;
    const value = typeof raw === 'string' ? raw : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : null;
    if (value === null) continue;
    const clean = value.replace(/\s+/g, ' ').trim();
    out.push(`${key}: ${clean.length > valueMax ? `${clean.slice(0, valueMax - 1).trimEnd()}…` : clean}`);
    if (out.length >= max) break;
  }
  return out;
}
