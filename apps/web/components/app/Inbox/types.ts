/** Tipos de la Bandeja (web-41). Reflejan lo que responde `GET /api/conversations` y su detalle. */

export type InboxView = 'all' | 'needs' | 'mine' | 'closed';

export const INBOX_VIEWS: readonly InboxView[] = ['all', 'needs', 'mine', 'closed'];

export type ConversationStatus = 'active' | 'human_takeover' | 'closed';

/** Quién escribió un mensaje: cliente, agente (IA), persona del equipo o sistema. */
export type MessageRole = 'user' | 'assistant' | 'human' | 'system';

export interface InboxFilters {
  view: InboxView;
  agentId: string | null;
  channel: string | null;
  /** `true` = todo el historial; `false` = últimos 8 días (por defecto). */
  allTime: boolean;
}

export interface RowContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
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
  lastMessage: {
    content: string;
    role: MessageRole | null;
    sentByName?: string | null;
    sentById?: string | null;
  } | null;
}

export interface ListResponse {
  conversations: ConversationRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface InboxCounts {
  all: number;
  needs: number;
  mine: number;
  closed: number;
  byAgent: Array<{ agentId: string; agentName: string; count: number }>;
  byChannel: Array<{ channel: string; count: number }>;
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
}

export interface DetailResponse {
  conversation: ConversationDetail;
  messages: ThreadMessage[];
  pagination: { total: number; hasMore: boolean; oldestTimestamp: string | null };
}

export interface TimelineEvent {
  type: string;
  description: string;
  date: string;
  metadata?: Record<string, unknown>;
}
