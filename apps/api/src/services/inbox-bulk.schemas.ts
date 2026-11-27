/**
 * Bandeja (web-44): cuerpos de las acciones en lote. Los ids se aceptan como texto: uno que no existe,
 * que es de otra organización o que no es un UUID se salta como `not_found`, sin decir más.
 */
import { z } from 'zod';
import { INBOX_LIMITS } from '@gensmart/shared';
import { CLOSE_OUTCOMES, TRANSFER_NOTE_MAX } from './conversation-events.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

const idsSchema = z
  .array(z.string().max(64))
  .min(1, 'ids must have at least 1 conversation')
  .max(INBOX_LIMITS.bulkMax, `ids must have at most ${INBOX_LIMITS.bulkMax} conversations`)
  .transform((ids) => [...new Set(ids)]);

export const bulkAssignSchema = z.object({
  ids: idsSchema,
  toUserId: z.string().regex(UUID_RE, 'toUserId must be a UUID'),
  note: z
    .string()
    .max(TRANSFER_NOTE_MAX, `note must be at most ${TRANSFER_NOTE_MAX} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ?? '').trim()),
});

export const bulkCloseSchema = z.object({
  ids: idsSchema,
  outcome: z.enum(CLOSE_OUTCOMES),
});

const labelIdList = z.array(z.string().uuid()).max(INBOX_LIMITS.labelsPerConversation).default([]);

export const bulkLabelsSchema = z
  .object({ ids: idsSchema, add: labelIdList, remove: labelIdList })
  .refine((v) => v.add.length > 0 || v.remove.length > 0, 'add or remove is required');

/** DELETE /bulk (web-42) conserva su cuerpo `{ conversationIds }`; ahora con el mismo tope que el resto. */
export const bulkDeleteSchema = z.object({ conversationIds: idsSchema });
