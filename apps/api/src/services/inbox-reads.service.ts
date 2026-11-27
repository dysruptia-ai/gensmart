/**
 * Bandeja (web-44): leído y no leído por persona. Es algo personal: no deja evento en
 * conversation_events y solo se emite a las conexiones de esa persona (sala `user:<id>`, la misma de
 * las notificaciones), nunca a `org:<id>`. El agente no lo usa.
 */
import { query } from '../config/database';
import { getIO } from '../config/websocket';

function emitReadState(organizationId: string, userId: string, conversationId: string, unread: boolean): void {
  try {
    getIO().to(`user:${userId}`).emit('conversation:read-state', { organizationId, conversationId, unread });
  } catch {
    // WebSocket not initialized (tests)
  }
}

/** last_read_at = ahora y quita "no leída". Idempotente. false si la conversación no es de la organización. */
export async function markRead(organizationId: string, userId: string, conversationId: string): Promise<boolean> {
  const r = await query(
    `INSERT INTO conversation_reads (conversation_id, user_id, organization_id, last_read_at, marked_unread_at)
     SELECT c.id, $2, c.organization_id, NOW(), NULL FROM conversations c WHERE c.id = $1 AND c.organization_id = $3
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = NOW(), marked_unread_at = NULL
     RETURNING conversation_id`,
    [conversationId, userId, organizationId]
  );
  if ((r.rowCount ?? 0) === 0) return false;
  emitReadState(organizationId, userId, conversationId, false);
  return true;
}

/** "Marcar como no leída": marked_unread_at = ahora y conserva last_read_at. */
export async function markUnread(organizationId: string, userId: string, conversationId: string): Promise<boolean> {
  const r = await query(
    `INSERT INTO conversation_reads (conversation_id, user_id, organization_id, last_read_at, marked_unread_at)
     SELECT c.id, $2, c.organization_id, '-infinity'::timestamptz, NOW() FROM conversations c WHERE c.id = $1 AND c.organization_id = $3
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET marked_unread_at = NOW()
     RETURNING conversation_id`,
    [conversationId, userId, organizationId]
  );
  if ((r.rowCount ?? 0) === 0) return false;
  emitReadState(organizationId, userId, conversationId, true);
  return true;
}

/** Emite a las conexiones de una persona (otras pestañas). */
export function emitToUser(userId: string, event: string, payload: Record<string, unknown>): void {
  try {
    getIO().to(`user:${userId}`).emit(event, payload);
  } catch {
    // WebSocket not initialized (tests)
  }
}
