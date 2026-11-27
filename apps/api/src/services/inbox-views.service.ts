/**
 * Bandeja (web-44): vistas guardadas. Son personales: cada persona ve, edita y borra solo las suyas
 * (ni owner ni admin ven las de otros). Los criterios se guardan en `filters` y se convierten en las
 * mismas condiciones de la lista (buildInboxConditions), así el contador coincide con lo que se ve.
 */
import { z } from 'zod';
import { INBOX_LIMITS } from '@gensmart/shared';
import { query } from '../config/database';
import { INBOX_FROM, type InboxFilterInput, type InboxView, buildInboxConditions } from './inbox-query.service';

export const VIEW_STATES = ['open', 'needs', 'agent_only', 'mine', 'closed'] as const;
export type ViewState = (typeof VIEW_STATES)[number];

const uuidList = z.array(z.string().uuid()).max(100);

export const viewFiltersSchema = z
  .object({
    channels: z.array(z.string().min(1).max(40)).max(20).optional(),
    agentIds: uuidList.optional(),
    labelIds: uuidList.optional(),
    minScore: z.union([z.literal(5), z.literal(7), z.literal(9)]).nullable().optional(),
    state: z.enum(VIEW_STATES).optional(),
    allTime: z.boolean().optional(),
  })
  .strict();

export type ViewFilters = z.infer<typeof viewFiltersSchema>;

export const viewNameSchema = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length > 0, 'name is required')
  .refine((v) => [...v].length <= INBOX_LIMITS.savedViewNameMax, `name must be at most ${INBOX_LIMITS.savedViewNameMax} characters`);

export const viewCreateSchema = z.object({ name: viewNameSchema, filters: viewFiltersSchema.default({}) }).strict();
export const viewUpdateSchema = z
  .object({ name: viewNameSchema.optional(), filters: viewFiltersSchema.optional(), position: z.number().int().min(0).max(1000).optional() })
  .strict()
  .refine((v) => v.name !== undefined || v.filters !== undefined || v.position !== undefined, 'nothing to update');

/** El estado de la vista → la `view` de la lista (+ agentOnly para "Solo el agente"). */
export function viewToFilterInput(filters: ViewFilters, base: { orgId: string; userId: string; timezone: string | null }): InboxFilterInput {
  const state: ViewState = filters.state ?? 'open';
  const view: InboxView = state === 'needs' ? 'needs' : state === 'mine' ? 'mine' : state === 'closed' ? 'closed' : 'all';
  return {
    ...base,
    view,
    agentOnly: state === 'agent_only',
    channels: filters.channels ?? [],
    agentIds: filters.agentIds ?? [],
    labelIds: filters.labelIds ?? [],
    minScore: filters.minScore ?? null,
    range: filters.allTime ? 'all' : undefined,
  };
}

/** Cuántas conversaciones mostraría la vista ahora. */
export async function countForView(filters: ViewFilters, base: { orgId: string; userId: string; timezone: string | null }): Promise<number> {
  const f = buildInboxConditions(viewToFilterInput(filters, base));
  const r = await query<{ count: string }>(`SELECT COUNT(*) AS count ${INBOX_FROM} WHERE ${f.conditions.join(' AND ')}`, f.params);
  return parseInt(r.rows[0]?.count ?? '0', 10);
}

/** Corre `fn` sobre todos los elementos con a lo sumo `limit` a la vez, conservando el orden. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Quita de los criterios las etiquetas y los agentes que ya no existen en la organización.
 * Devuelve los criterios limpios y si cambiaron (para guardarlos así).
 */
export async function pruneFilters(orgId: string, filters: ViewFilters): Promise<{ filters: ViewFilters; changed: boolean }> {
  const labelIds = filters.labelIds ?? [];
  const agentIds = filters.agentIds ?? [];
  if (labelIds.length === 0 && agentIds.length === 0) return { filters, changed: false };
  const [labels, agents] = await Promise.all([
    labelIds.length
      ? query<{ id: string }>('SELECT id FROM inbox_labels WHERE organization_id = $1 AND id = ANY($2::uuid[])', [orgId, labelIds])
      : Promise.resolve({ rows: [] as { id: string }[] }),
    agentIds.length
      ? query<{ id: string }>('SELECT id FROM agents WHERE organization_id = $1 AND id = ANY($2::uuid[])', [orgId, agentIds])
      : Promise.resolve({ rows: [] as { id: string }[] }),
  ]);
  const okLabels = new Set(labels.rows.map((r) => r.id));
  const okAgents = new Set(agents.rows.map((r) => r.id));
  const nextLabels = labelIds.filter((id) => okLabels.has(id));
  const nextAgents = agentIds.filter((id) => okAgents.has(id));
  const changed = nextLabels.length !== labelIds.length || nextAgents.length !== agentIds.length;
  if (!changed) return { filters, changed };
  const next: ViewFilters = { ...filters };
  if (filters.labelIds) next.labelIds = nextLabels;
  if (filters.agentIds) next.agentIds = nextAgents;
  return { filters: next, changed };
}

function intersect(a: readonly string[], b: readonly string[]): string[] {
  if (a.length === 0) return [...b];
  if (b.length === 0) return [...a];
  const set = new Set(b);
  const both = a.filter((x) => set.has(x));
  // Vacía = no coincide con nada (un valor que no existe)
  return both.length ? both : ['__none__'];
}

/**
 * La lista de una vista guardada con los filtros del panel encima (AND), sin cambiar la vista:
 * su estado y su periodo mandan; canal y agente se intersecan (cada conversación tiene uno), el
 * puntaje es el mayor, y las etiquetas de los dos lados deben cumplirse.
 * Con búsqueda, buildInboxConditions ignora el estado y el periodo, y los demás criterios siguen.
 */
export function mergeSavedView(request: InboxFilterInput, filters: ViewFilters): InboxFilterInput {
  const v = viewToFilterInput(filters, { orgId: request.orgId, userId: request.userId, timezone: request.timezone ?? null });
  const scores = [request.minScore, v.minScore].filter((n): n is number => typeof n === 'number');
  return {
    ...request,
    view: v.view,
    range: v.range,
    outcome: null,
    agentOnly: !!v.agentOnly || !!request.agentOnly,
    channels: intersect(v.channels ?? [], [...(request.channels ?? []), ...(request.channel ? [request.channel] : [])]),
    channel: undefined,
    agentIds: intersect(v.agentIds ?? [], [...(request.agentIds ?? []), ...(request.agentId ? [request.agentId] : [])]),
    agentId: undefined,
    labelIds: v.labelIds ?? [],
    extraLabelIds: request.labelIds ?? [],
    minScore: scores.length ? Math.max(...scores) : null,
  };
}

/** Los criterios de una vista de quien llama, o null si no existe o es de otra persona. */
export async function findOwnView(orgId: string, userId: string, viewId: string): Promise<ViewFilters | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(viewId)) return null;
  const r = await query<{ filters: unknown }>(
    'SELECT filters FROM inbox_views WHERE id = $1 AND organization_id = $2 AND user_id = $3',
    [viewId, orgId, userId]
  );
  if (!r.rows[0]) return null;
  const parsed = viewFiltersSchema.safeParse(r.rows[0].filters ?? {});
  return parsed.success ? parsed.data : {};
}
