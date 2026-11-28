/**
 * Reparto automático de la Bandeja (web-45). Cuando una conversación pide ayuda y nadie la tiene, el
 * sistema la asigna a alguien del equipo que pueda recibirla: `receives = true`, en línea y con
 * `openCount < capacity`. Orden de elección:
 *   1. "mantener con la última persona" (la última del equipo que escribió a ese contacto);
 *   2. en el modo "por agente", la persona responsable del agente;
 *   3. rotativo: la de `last_assigned_at` más antiguo (o nunca), desempate por user_id.
 * Si nadie puede, queda sin dueño en "Necesitan", como siempre.
 *
 * Concurrencia: todo el cálculo (cupos y elección) y la asignación corren con un
 * pg_advisory_xact_lock por organización. La UPDATE de transferConversation se confirma antes de soltar
 * el lock, así que el siguiente ve el cupo ya ocupado.
 */
import type { PoolClient } from 'pg';

/** Corre una consulta en el pool o en el cliente de la transacción. */
type Run = <T>(sql: string, params: unknown[]) => Promise<{ rows: T[] }>;
const onPool: Run = (sql, params) => query(sql, params);
const onClient =
  (client: PoolClient): Run =>
  async <T>(sql: string, params: unknown[]) => {
    const r = await client.query(sql, params);
    return { rows: r.rows as T[] };
  };
import { getClient, query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { type AssignMode, planAllowsTakeover, transferConversation } from './conversation-actions.service';
import { HANDOFF_ACTIVE_SQL } from './inbox-query.service';
import { getInboxSettings, MEMBER_DEFAULT_CAPACITY, type InboxSettings } from './inbox-settings.service';
import { onlineUsers } from './presence.service';

export interface TeamMember {
  userId: string;
  name: string | null;
  role: string;
  openCount: number;
  capacity: number;
  receives: boolean;
}

/** El equipo con su cupo y cuántas tiene ahora (las `human_takeover` a su nombre). */
export async function getTeam(organizationId: string, run: Run = onPool): Promise<TeamMember[]> {
  const sql = `SELECT uo.user_id, u.name, uo.role,
            COALESCE(ims.capacity, ${MEMBER_DEFAULT_CAPACITY}) AS capacity,
            COALESCE(ims.receives, true) AS receives,
            (SELECT COUNT(*) FROM conversations c
              WHERE c.organization_id = uo.organization_id AND c.status = 'human_takeover'
                AND c.taken_over_by = uo.user_id) AS open_count
     FROM user_organizations uo
     JOIN users u ON u.id = uo.user_id
     LEFT JOIN inbox_member_settings ims ON ims.organization_id = uo.organization_id AND ims.user_id = uo.user_id
     WHERE uo.organization_id = $1
     ORDER BY CASE uo.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name NULLS LAST, uo.user_id`;
  type Row = { user_id: string; name: string | null; role: string; capacity: number; receives: boolean; open_count: string };
  const r = await run<Row>(sql, [organizationId]);
  return r.rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    role: row.role,
    capacity: row.capacity,
    receives: row.receives,
    openCount: parseInt(row.open_count, 10),
  }));
}

interface Candidate {
  userId: string;
  lastAssignedAt: string | null;
}

/**
 * La elección (pura): quién de los que pueden recibirla. Exportada para los tests.
 */
export function pickAssignee(
  candidates: readonly Candidate[],
  opts: { keepLastUserId: string | null; agentAssigneeId: string | null; mode: 'rotating' | 'agent' }
): { userId: string; mode: AssignMode } | null {
  if (candidates.length === 0) return null;
  const can = new Set(candidates.map((c) => c.userId));
  if (opts.keepLastUserId && can.has(opts.keepLastUserId)) return { userId: opts.keepLastUserId, mode: 'keep_last' };
  if (opts.mode === 'agent' && opts.agentAssigneeId && can.has(opts.agentAssigneeId)) {
    return { userId: opts.agentAssigneeId, mode: 'agent' };
  }
  const sorted = [...candidates].sort((a, b) => {
    if (a.lastAssignedAt === b.lastAssignedAt) return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    if (a.lastAssignedAt === null) return -1;
    if (b.lastAssignedAt === null) return 1;
    return a.lastAssignedAt < b.lastAssignedAt ? -1 : 1;
  });
  return { userId: sorted[0]!.userId, mode: 'rotating' };
}

interface ConvRow {
  id: string;
  organization_id: string;
  agent_id: string | null;
  contact_id: string | null;
  status: string;
  taken_over_by: string | null;
  snoozed_until: string | null;
  handoff_active: boolean;
  plan: string;
}

async function loadConversation(run: Run, conversationId: string): Promise<ConvRow | undefined> {
  const r = await run<ConvRow>(
    `SELECT c.id, c.organization_id, c.agent_id, c.contact_id, c.status, c.taken_over_by, c.snoozed_until,
            ${HANDOFF_ACTIVE_SQL} AS handoff_active, o.plan
     FROM conversations c
     LEFT JOIN agents a ON a.id = c.agent_id
     JOIN organizations o ON o.id = c.organization_id
     WHERE c.id = $1`,
    [conversationId]
  );
  return r.rows[0];
}

function assignable(conv: ConvRow | undefined): conv is ConvRow {
  return (
    !!conv &&
    conv.status !== 'closed' &&
    conv.status !== 'human_takeover' &&
    !conv.taken_over_by &&
    !conv.snoozed_until &&
    conv.handoff_active
  );
}

/**
 * Asigna una conversación si el modo y el plan lo permiten. Devuelve a quién, o null.
 * `settings` es opcional (assignPending ya los tiene).
 */
export async function autoAssign(conversationId: string, settings?: InboxSettings): Promise<string | null> {
  const first = await loadConversation(onPool, conversationId);
  if (!assignable(first) || !planAllowsTakeover(first.plan)) return null;
  const s = settings ?? (await getInboxSettings(first.organization_id));
  if (s.assignmentMode === 'none') return null;
  const orgId = first.organization_id;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('inbox-assign:' || $1::text))`, [orgId]);

    // Dentro del lock: otra llamada pudo asignarla mientras esperábamos
    const conv = await loadConversation(onClient(client), conversationId);
    if (!assignable(conv)) {
      await client.query('ROLLBACK');
      return null;
    }

    const online = new Set(await onlineUsers(orgId));
    const team = await getTeam(orgId, onClient(client));
    const lastAssigned = await client.query<{ user_id: string; last_assigned_at: string | null }>(
      'SELECT user_id, last_assigned_at FROM inbox_member_settings WHERE organization_id = $1',
      [orgId]
    );
    const lastBy = new Map(lastAssigned.rows.map((r) => [r.user_id, r.last_assigned_at]));
    const candidates: Candidate[] = team
      .filter((m) => m.receives && online.has(m.userId) && m.openCount < m.capacity)
      .map((m) => ({ userId: m.userId, lastAssignedAt: lastBy.get(m.userId) ?? null }));
    if (candidates.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    let keepLastUserId: string | null = null;
    if (s.keepLastPerson && conv.contact_id) {
      const last = await client.query<{ id: string | null }>(
        `SELECT m.metadata->'sentBy'->>'id' AS id
         FROM messages m JOIN conversations c2 ON c2.id = m.conversation_id
         WHERE c2.contact_id = $1 AND c2.organization_id = $2 AND m.role = 'human'
           AND m.metadata->'sentBy'->>'id' IS NOT NULL
         ORDER BY m.created_at DESC LIMIT 1`,
        [conv.contact_id, orgId]
      );
      keepLastUserId = last.rows[0]?.id ?? null;
    }
    let agentAssigneeId: string | null = null;
    if (s.assignmentMode === 'agent' && conv.agent_id) {
      const a = await client.query<{ user_id: string }>(
        'SELECT user_id FROM inbox_agent_assignees WHERE agent_id = $1 AND organization_id = $2',
        [conv.agent_id, orgId]
      );
      agentAssigneeId = a.rows[0]?.user_id ?? null;
    }

    const choice = pickAssignee(candidates, { keepLastUserId, agentAssigneeId, mode: s.assignmentMode });
    if (!choice) {
      await client.query('ROLLBACK');
      return null;
    }

    try {
      await transferConversation({
        organizationId: orgId,
        plan: conv.plan,
        actor: null,
        assignMode: choice.mode,
        conversationId,
        toUserId: choice.userId,
        note: '',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof AppError) return null; // la tomó alguien o se cerró mientras tanto
      throw err;
    }

    await client.query(
      `INSERT INTO inbox_member_settings (organization_id, user_id, last_assigned_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET last_assigned_at = NOW()`,
      [orgId, choice.userId]
    );
    await client.query('COMMIT');
    return choice.userId;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Igual que autoAssign, pero un fallo nunca tumba a quien lo llama (el pedido de ayuda ya quedó). */
export async function autoAssignSafe(conversationId: string): Promise<string | null> {
  try {
    return await autoAssign(conversationId);
  } catch (err) {
    console.error('[inbox-assignment] autoAssign failed:', (err as Error).message);
    return null;
  }
}

/**
 * Reparte las que quedaron sin dueño con un pedido de ayuda vigente, de la más antigua a la más nueva,
 * hasta que se acabe el cupo. Se llama al conectarse alguien, al liberar cupo y desde el cron.
 * `onlyIds` es solo para los tests.
 */
export async function assignPending(organizationId: string, onlyIds?: readonly string[]): Promise<number> {
  const s = await getInboxSettings(organizationId);
  if (s.assignmentMode === 'none') return 0;
  const pending = await query<{ id: string }>(
    `SELECT c.id FROM conversations c
     LEFT JOIN agents a ON a.id = c.agent_id
     WHERE c.organization_id = $1 AND c.status <> 'closed' AND c.status <> 'human_takeover'
       AND c.taken_over_by IS NULL AND c.snoozed_until IS NULL AND ${HANDOFF_ACTIVE_SQL}
       AND ($2::uuid[] IS NULL OR c.id = ANY($2::uuid[]))
     ORDER BY c.handed_off_at ASC, c.id ASC
     LIMIT 200`,
    [organizationId, onlyIds ? [...onlyIds] : null]
  );
  let assigned = 0;
  for (const row of pending.rows) {
    const who = await autoAssign(row.id, s);
    if (who) assigned++;
  }
  return assigned;
}

export function assignPendingSafe(organizationId: string): void {
  void assignPending(organizationId).catch((err: unknown) =>
    console.error('[inbox-assignment] assignPending failed:', (err as Error).message)
  );
}

/** Para el cron de cada minuto: solo las organizaciones con un modo distinto de 'none'. */
export async function assignPendingAll(): Promise<number> {
  const orgs = await query<{ organization_id: string }>(
    `SELECT organization_id FROM inbox_settings WHERE assignment_mode <> 'none'`
  );
  let total = 0;
  for (const o of orgs.rows) {
    try {
      total += await assignPending(o.organization_id);
    } catch (err) {
      console.error('[inbox-assignment] assignPending failed:', (err as Error).message);
    }
  }
  return total;
}
