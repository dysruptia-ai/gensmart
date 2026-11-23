import type { MockChannel } from '../ProductSubpage/ChannelIcon';

export type ConversationStatus = 'active' | 'human' | 'closed';

/** Clase de la píldora de estado del diseño (`.st.a`, `.st.p`, `.st.c`). */
export const STATUS_CLASS: Record<ConversationStatus, string> = { active: 'a', human: 'p', closed: 'c' };

export interface MockConversation {
  name: string;
  channel: MockChannel;
  /** Clave de i18n del último mensaje. */
  lastKey: string;
  agentKey: string;
  status: ConversationStatus;
  agoKey: string;
}

const S = 'site.productShared';

/** Conversaciones de ejemplo de la bandeja (lista del hero y tabla de búsqueda). */
export const CONVERSATIONS: readonly MockConversation[] = [
  { name: 'Valentina', channel: 'instagram', lastKey: `${S}.valentina.last`, agentKey: `${S}.agent.realEstate`, status: 'active', agoKey: `${S}.ago.m2` },
  { name: 'Andrés', channel: 'whatsapp', lastKey: `${S}.rows.andres`, agentKey: `${S}.agent.sales`, status: 'human', agoKey: `${S}.ago.m27` },
  { name: 'Mateo', channel: 'telegram', lastKey: `${S}.rows.mateo`, agentKey: `${S}.agent.realEstate`, status: 'active', agoKey: `${S}.ago.m54` },
  { name: 'Laura', channel: 'web', lastKey: `${S}.rows.laura`, agentKey: `${S}.agent.realEstate`, status: 'closed', agoKey: `${S}.ago.h1` },
];

/** Orden de la lista del hero (como en el diseño). */
export const HERO_ORDER = ['Valentina', 'Andrés', 'Laura', 'Mateo'];
