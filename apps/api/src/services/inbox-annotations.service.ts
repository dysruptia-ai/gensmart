/**
 * Bandeja (web-43): notas internas, etiquetas de conversación y respuestas rápidas.
 *
 * Las notas viven en `conversation_notes`, fuera de `messages`: el worker del agente, el scoring y el
 * resumen de la intervención leen solo `messages`, así que nunca las ven. Tampoco salen por el canal.
 */
import { z } from 'zod';
import { INBOX_LIMITS, QUICK_REPLY_SHORTCUT_RE } from '@gensmart/shared';
import { query } from '../config/database';
import { getIO } from '../config/websocket';

/** owner y admin administran respuestas rápidas y etiquetas, y borran notas ajenas. */
export const INBOX_ADMIN_ROLES = ['owner', 'admin'] as const;
export function isInboxAdmin(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

// ── emisión ──────────────────────────────────────────────────────────────────

/** Emite a la organización y, si hay, a la sala de la conversación. Sin WebSocket (tests) no hace nada. */
export function emitInbox(organizationId: string, event: string, payload: Record<string, unknown>, conversationId?: string): void {
  try {
    const io = getIO();
    const target = conversationId ? io.to(`org:${organizationId}`).to(`conv:${conversationId}`) : io.to(`org:${organizationId}`);
    target.emit(event, payload);
  } catch {
    // WebSocket not initialized (tests)
  }
}

// ── notas ────────────────────────────────────────────────────────────────────

export const noteBodySchema = z.object({
  body: z
    .string()
    .refine((v) => v.trim().length > 0, 'body is required')
    .refine((v) => [...v].length <= INBOX_LIMITS.noteMaxChars, `body must be at most ${INBOX_LIMITS.noteMaxChars} characters`),
});

export interface ApiNote {
  id: string;
  body: string;
  authorUserId: string | null;
  authorName: string | null;
  createdAt: string;
  canDelete: boolean;
}

interface NoteRow {
  id: string;
  body: string;
  author_user_id: string | null;
  author_name: string | null;
  created_at: string;
}

export function rowToNote(row: NoteRow, userId: string, role: string | undefined): ApiNote {
  return {
    id: row.id,
    body: row.body,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    createdAt: row.created_at,
    canDelete: row.author_user_id === userId || isInboxAdmin(role),
  };
}

/** Las notas sin borrar, de la más vieja a la más nueva (las 500 más recientes). */
export async function listNotes(conversationId: string, organizationId: string, userId: string, role: string | undefined): Promise<ApiNote[]> {
  const r = await query<NoteRow>(
    `SELECT * FROM (
       SELECT n.id, n.body, n.author_user_id, u.name AS author_name, n.created_at
       FROM conversation_notes n
       LEFT JOIN users u ON u.id = n.author_user_id
       WHERE n.conversation_id = $1 AND n.organization_id = $2 AND n.deleted_at IS NULL
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT $3
     ) t ORDER BY created_at ASC, id ASC`,
    [conversationId, organizationId, INBOX_LIMITS.notesPerConversationShown]
  );
  return r.rows.map((row) => rowToNote(row, userId, role));
}

/** Guarda una nota. No toca la conversación (ni last_message_at, ni message_count, ni la espera). */
export async function createNote(input: {
  organizationId: string;
  conversationId: string;
  authorUserId: string;
  body: string;
}): Promise<NoteRow> {
  const r = await query<NoteRow>(
    `WITH n AS (
       INSERT INTO conversation_notes (organization_id, conversation_id, author_user_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, body, author_user_id, created_at
     )
     SELECT n.id, n.body, n.author_user_id, u.name AS author_name, n.created_at
     FROM n LEFT JOIN users u ON u.id = n.author_user_id`,
    [input.organizationId, input.conversationId, input.authorUserId, input.body]
  );
  return r.rows[0]!;
}

// ── etiquetas ────────────────────────────────────────────────────────────────

export const labelNameSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, 'name is required')
    .refine((v) => [...v].length <= INBOX_LIMITS.labelNameMaxChars, `name must be at most ${INBOX_LIMITS.labelNameMaxChars} characters`),
});

export const setLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()).max(INBOX_LIMITS.labelsPerConversation * 5),
});

export interface LabelRef {
  id: string;
  name: string;
}

/** Subquery para la lista y el detalle: las etiquetas de `c` en orden alfabético. */
export const CONVERSATION_LABELS_SQL = `COALESCE((
  SELECT json_agg(json_build_object('id', l.id, 'name', l.name) ORDER BY lower(l.name), l.id)
  FROM conversation_labels cl
  JOIN inbox_labels l ON l.id = cl.label_id
  WHERE cl.conversation_id = c.id
), '[]'::json)`;

export async function getConversationLabels(conversationId: string): Promise<LabelRef[]> {
  const r = await query<LabelRef>(
    `SELECT l.id, l.name FROM conversation_labels cl JOIN inbox_labels l ON l.id = cl.label_id
     WHERE cl.conversation_id = $1 ORDER BY lower(l.name), l.id`,
    [conversationId]
  );
  return r.rows;
}

// ── respuestas rápidas ──────────────────────────────────────────────────────

/** Quita la "/" de adelante y los espacios, y pasa a minúsculas. */
export function normalizeShortcut(value: string): string {
  return value.trim().replace(/^\/+/, '').toLowerCase();
}

export const quickReplyShortcutSchema = z
  .string()
  .transform(normalizeShortcut)
  .refine((v) => QUICK_REPLY_SHORTCUT_RE.test(v), 'invalid shortcut');

export const quickReplyBodySchema = z
  .string()
  .refine((v) => v.trim().length > 0, 'body is required')
  .refine((v) => [...v].length <= INBOX_LIMITS.quickReplyMaxChars, `body must be at most ${INBOX_LIMITS.quickReplyMaxChars} characters`);

export const quickReplyCreateSchema = z.object({ shortcut: quickReplyShortcutSchema, body: quickReplyBodySchema });
export const quickReplyUpdateSchema = z
  .object({ shortcut: quickReplyShortcutSchema.optional(), body: quickReplyBodySchema.optional() })
  .refine((v) => v.shortcut !== undefined || v.body !== undefined, 'nothing to update');

/** Postgres: violación de índice único. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
