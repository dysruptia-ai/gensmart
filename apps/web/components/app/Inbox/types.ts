/** Tipos de la Bandeja (web-41). Reflejan lo que responde `GET /api/conversations` y su detalle. */
import type { HandoffReason } from '@gensmart/shared';

export type { HandoffReason };

export type InboxView = 'all' | 'needs' | 'mine' | 'closed';

export const INBOX_VIEWS: readonly InboxView[] = ['all', 'needs', 'mine', 'closed'];

export type ConversationStatus = 'active' | 'human_takeover' | 'closed';

/** Resultado del cierre (web-42). Las cerradas antes de esta versión no tienen. */
export type CloseOutcome = 'sold' | 'resolved' | 'no_response' | 'spam';

export const CLOSE_OUTCOMES: readonly CloseOutcome[] = ['sold', 'resolved', 'no_response', 'spam'];

/** Quién escribió un mensaje: cliente, agente (IA), persona del equipo o sistema. */
export type MessageRole = 'user' | 'assistant' | 'human' | 'system';

/** Orden de "Todas" (web-44): por urgencia (el de siempre), por recientes o sin leer primero. */
export type InboxOrder = 'needs' | 'recent' | 'unread';

export const INBOX_ORDERS: readonly InboxOrder[] = ['needs', 'recent', 'unread'];

/** Puntajes mínimos que se pueden elegir. */
export const MIN_SCORES = [5, 7, 9] as const;
export type MinScore = (typeof MIN_SCORES)[number];

export interface InboxFilters {
  view: InboxView;
  /** Agentes, canales y etiquetas (web-44): cualquiera de los valores dentro de cada filtro. */
  agentIds: string[];
  channels: string[];
  labelIds: string[];
  minScore: MinScore | null;
  /** `true` = todo el historial; `false` = últimos 8 días (por defecto). */
  allTime: boolean;
  /** Filtro de "Cerradas" por resultado (`?outcome=`). */
  outcome: CloseOutcome | null;
  order: InboxOrder;
  /** Vista guardada abierta (`?savedView=`). */
  savedView: string | null;
}

/** Estado de una vista guardada (web-44). */
export type ViewState = 'open' | 'needs' | 'agent_only' | 'mine' | 'closed';

export const VIEW_STATES: readonly ViewState[] = ['open', 'needs', 'agent_only', 'mine', 'closed'];

export interface SavedViewFilters {
  channels?: string[];
  agentIds?: string[];
  labelIds?: string[];
  minScore?: MinScore | null;
  state?: ViewState;
  allTime?: boolean;
}

/** Vista guardada (`GET /api/inbox-views`): personal, solo la ve quien la creó. */
export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
  count: number;
}

export interface RowContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/** Etiqueta aplicada a una conversación (web-43). */
export interface LabelRef {
  id: string;
  name: string;
}

/** Etiqueta del catálogo de la organización (`GET /api/inbox-labels`). */
export interface InboxLabel extends LabelRef {
  conversationCount: number;
}

/** Nota interna (web-43): solo la ve el equipo; el agente nunca la lee. */
export interface ApiNote {
  id: string;
  body: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
  canDelete: boolean;
}

export interface ConversationRow {
  id: string;
  agentId: string;
  agentName: string | null;
  contact: RowContact | null;
  channel: string;
  status: ConversationStatus;
  takenOverBy: string | null;
  takeoverUserName: string | null;
  aiScore: number | null;
  lastMessageAt: string | null;
  createdAt: string;
  handedOffAt: string | null;
  handoffActive: boolean;
  needsAttention: boolean;
  waitingSince: string | null;
  /** Pospuesta hasta (web-42). */
  snoozedUntil?: string | null;
  snoozedBy?: string | null;
  /** Hora en que volvió de posponer. */
  followUpAt?: string | null;
  /** "Seguimiento para hoy": volvió hoy y nadie respondió después. */
  followUpPending?: boolean;
  closedOutcome?: CloseOutcome | null;
  closedAt?: string | null;
  closedBy?: string | null;
  closedByName?: string | null;
  /** Etiquetas en orden alfabético (web-43). */
  labels?: LabelRef[];
  /** Sin leer para quien mira (web-44). */
  unread?: boolean;
  /** Con búsqueda: el mensaje más reciente que coincide (null si solo coincide el contacto). */
  searchMatch?: {
    content: string;
    role: MessageRole | null;
    createdAt: string;
    sentByName?: string | null;
    sentById?: string | null;
  } | null;
  lastMessage: {
    content: string;
    role: MessageRole | null;
    sentByName?: string | null;
    sentById?: string | null;
  } | null;
}

export interface ListResponse {
  conversations: ConversationRow[];
  /** No leídas con los filtros y la vista actuales (web-44). */
  unreadCount?: number;
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface InboxCounts {
  all: number;
  needs: number;
  mine: number;
  closed: number;
  byAgent: Array<{ agentId: string; agentName: string; count: number; inboxPausedAt?: string | null }>;
  byChannel: Array<{ channel: string; count: number }>;
  /** web-45: desde cuándo espera la más antigua de "Necesitan" (null si no hay ninguna). */
  oldestWaitingSince?: string | null;
  /** web-45: canales desconectados o por vencer, por agente (correo y web no entran). */
  channelIssues?: ChannelIssue[];
}

export interface ChannelIssue {
  agentId: string;
  agentName: string;
  channel: string;
  kind: 'disconnected' | 'expiring';
  since?: string;
  expiresAt?: string;
}

export interface MessageMetadata {
  type?: string;
  error?: boolean;
  hasImages?: boolean;
  imageCount?: number;
  images?: Array<{ mimeType: string; data?: string; hasCaption?: boolean }>;
  isVoiceMessage?: boolean;
  media?: { type: 'image' | 'video' | 'document'; url: string; caption?: string | null };
  handoff?: { url: string; buttonText: string; contactName?: string };
  sentBy?: { id: string; name: string | null };
  [key: string]: unknown;
}

export interface ThreadMessage {
  id: string;
  role: MessageRole;
  content: string;
  metadata: MessageMetadata;
  createdAt: string;
  /** Solo en el cliente: mensajes propios que se están enviando o que fallaron. */
  delivery?: 'sending' | 'failed';
}

export interface DetailContact extends RowContact {
  aiScore: number | null;
  funnelStage: string | null;
  customVariables: Record<string, unknown>;
  aiService?: string | null;
}

export interface ConversationDetail {
  id: string;
  agentId: string;
  agentName: string | null;
  contact: DetailContact | null;
  channel: string;
  status: ConversationStatus;
  takenOverBy: string | null;
  takeoverUserName: string | null;
  takenOverAt: string | null;
  aiScore: number | null;
  capturedVariables: Record<string, unknown>;
  /** Datos del canal; en WhatsApp, `referral` si la conversación llegó desde un anuncio de Meta. */
  channelMetadata?: Record<string, unknown>;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  handedOffAt: string | null;
  handoffActive: boolean;
  needsAttention: boolean;
  waitingSince: string | null;
  lastCustomerMessageAt: string | null;
  snoozedUntil?: string | null;
  snoozedBy?: string | null;
  snoozedByName?: string | null;
  followUpAt?: string | null;
  closedOutcome?: CloseOutcome | null;
  closedAt?: string | null;
  closedBy?: string | null;
  closedByName?: string | null;
  labels?: LabelRef[];
}

export type ConversationEventType =
  | 'handoff_requested'
  | 'taken'
  | 'released'
  | 'transferred'
  | 'snoozed'
  | 'unsnoozed'
  | 'closed'
  | 'reopened'
  | 'note_deleted'
  | 'assigned';

/** Evento guardado en `conversation_events` (web-42). */
export interface ApiConversationEvent {
  id: string;
  type: ConversationEventType;
  actorUserId: string | null;
  actorName: string | null;
  targetUserId: string | null;
  targetName: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

/** Resultado de una acción en lote (web-44). */
export interface BulkResult {
  updated: string[];
  skipped: Array<{ id: string; reason: string }>;
}

/** Persona del equipo (`GET /api/organization/members`). */
export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

/** El pedido de ayuda vigente (web-46): causa y resumen del traspaso (o de la notificación, si es viejo). */
export interface HandoffInfo {
  eventId: string;
  requestedAt: string;
  reason: HandoffReason | null;
  teamSummary: string | null;
}

/** Resumen con IA de un pedido de ayuda sin team_summary (web-46). */
export interface AiSummary {
  text: string;
  createdAt: string;
}

/** Si la IA de la Bandeja está disponible para la organización (web-46). */
export interface AiAccess {
  enabled: boolean;
  planAllows: boolean;
  limitReached: boolean;
}

export interface DetailResponse {
  conversation: ConversationDetail;
  messages: ThreadMessage[];
  /** Historial de eventos (web-42); vacío en las conversaciones anteriores. */
  events?: ApiConversationEvent[];
  /** Notas internas sin borrar, de la más vieja a la más nueva (web-43). */
  notes?: ApiNote[];
  /** web-46 */
  handoff?: HandoffInfo | null;
  aiSummary?: AiSummary | null;
  ai?: AiAccess;
  pagination: { total: number; hasMore: boolean; oldestTimestamp: string | null };
}

export interface TimelineEvent {
  type: string;
  description: string;
  date: string;
  metadata?: Record<string, unknown>;
}
