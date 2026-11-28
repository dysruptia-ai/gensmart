/**
 * Solo para los tests :db de la Bandeja (web-43). Levanta las rutas reales en un puerto libre y crea
 * organizaciones propias con un sufijo aleatorio; cleanup() borra solo esas filas.
 */
import type { AddressInfo } from 'node:net';

export interface FixtureUser {
  id: string;
  token: string;
}

export interface CallResult {
  status: number;
  json: Record<string, unknown>;
}

export async function startInboxFixture(prefix: string) {
  const express = (await import('express')).default;
  const { pool, query } = await import('../config/database');
  const { generateAccessToken } = await import('../config/jwt');
  const { errorHandler } = await import('../middleware/errorHandler');
  const conversationsRouter = (await import('../routes/conversations')).default;
  const quickRepliesRouter = (await import('../routes/quick-replies')).default;
  const inboxLabelsRouter = (await import('../routes/inbox-labels')).default;
  const inboxViewsRouter = (await import('../routes/inbox-views')).default;
  const inboxSettingsRouter = (await import('../routes/inbox-settings')).default;
  const agentsRouter = (await import('../routes/agents')).default;
  const reportsRouter = (await import('../routes/reports')).default;

  const app = express();
  app.use(express.json());
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/quick-replies', quickRepliesRouter);
  app.use('/api/inbox-labels', inboxLabelsRouter);
  app.use('/api/inbox-views', inboxViewsRouter);
  app.use('/api/inbox-settings', inboxSettingsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/reports', reportsRouter);
  app.use(errorHandler);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

  const suffix = Math.random().toString(36).slice(2, 10);
  const orgIds: string[] = [];

  async function makeOrg(plan = 'pro'): Promise<string> {
    const r = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, plan) VALUES ($1, $1, $2) RETURNING id`,
      [`${prefix}-${plan}-${suffix}-${orgIds.length}`, plan]
    );
    orgIds.push(r.rows[0]!.id);
    return r.rows[0]!.id;
  }

  async function makeUser(orgId: string, name: string, role: string): Promise<FixtureUser> {
    const email = `${prefix}-${suffix}-${name.toLowerCase()}-${orgIds.length}@example.com`;
    const r = await query<{ id: string }>(
      `INSERT INTO users (organization_id, email, name, password_hash, role, email_verified, language)
       VALUES ($1, $2, $3, 'x', $4, true, 'es') RETURNING id`,
      [orgId, email, name, role]
    );
    const id = r.rows[0]!.id;
    await query('INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)', [id, orgId, role]);
    return { id, token: generateAccessToken({ userId: id, orgId, role, email, isSuperAdmin: false }) };
  }

  async function makeAgent(orgId: string, name = 'Agente de prueba'): Promise<string> {
    const r = await query<{ id: string }>(
      `INSERT INTO agents (organization_id, name, system_prompt, llm_provider, llm_model)
       VALUES ($1, $2, 'x', 'openai', 'gpt-4o-mini') RETURNING id`,
      [orgId, name]
    );
    return r.rows[0]!.id;
  }

  /** Conversación con un mensaje del cliente hace 10 minutos. */
  async function makeConversation(
    orgId: string,
    agentId: string,
    opts: { takenBy?: string; status?: string; contactId?: string } = {}
  ): Promise<string> {
    const contact = opts.contactId
      ? { rows: [{ id: opts.contactId }] }
      : await query<{ id: string }>('INSERT INTO contacts (organization_id, agent_id, name) VALUES ($1, $2, $3) RETURNING id', [
          orgId,
          agentId,
          `Cliente ${suffix}`,
        ]);
    const r = await query<{ id: string }>(
      `INSERT INTO conversations (organization_id, agent_id, contact_id, channel, status, taken_over_by, taken_over_at, last_message_at, message_count)
       VALUES ($1, $2, $3, 'web', $4, $5, CASE WHEN $5::uuid IS NULL THEN NULL ELSE NOW() END, NOW() - interval '10 minutes', 1)
       RETURNING id`,
      [orgId, agentId, contact.rows[0]!.id, opts.status ?? 'active', opts.takenBy ?? null]
    );
    const id = r.rows[0]!.id;
    await query(`INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, 'user', 'hola', NOW() - interval '10 minutes')`, [id]);
    return id;
  }

  async function call(token: string, method: string, p: string, body?: unknown): Promise<CallResult> {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
  }

  async function cleanup(): Promise<void> {
    server.close();
    for (const id of orgIds) {
      await query('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE organization_id = $1)', [id]);
      await query('DELETE FROM conversations WHERE organization_id = $1', [id]); // CASCADE: notas, eventos, etiquetas aplicadas
      await query('DELETE FROM inbox_labels WHERE organization_id = $1', [id]);
      await query('DELETE FROM inbox_views WHERE organization_id = $1', [id]);
      await query('DELETE FROM notifications WHERE organization_id = $1', [id]);
      await query('DELETE FROM quick_replies WHERE organization_id = $1', [id]);
      await query('DELETE FROM contacts WHERE organization_id = $1', [id]);
      await query('DELETE FROM agents WHERE organization_id = $1', [id]);
      await query('DELETE FROM user_organizations WHERE organization_id = $1', [id]);
      await query('DELETE FROM users WHERE organization_id = $1', [id]);
      await query('DELETE FROM organizations WHERE id = $1', [id]);
    }
    await pool.end();
  }

  /**
   * Graba lo que se emite por WebSocket (sala → evento → payload) sin un servidor real: reemplaza
   * `to()` del servidor de Socket.IO que levanta sobre el mismo HTTP server.
   */
  async function spyEmits(): Promise<{ emits: Emitted[]; reset: () => void }> {
    const { initWebSocket } = await import('../config/websocket');
    const io = initWebSocket(server) as unknown as { to: (room: string) => FakeTarget };
    const emits: Emitted[] = [];
    const target = (rooms: string[]): FakeTarget => ({
      to: (room: string) => target([...rooms, room]),
      emit: (event: string, payload: Record<string, unknown>) => {
        emits.push({ rooms, event, payload });
        return true;
      },
    });
    io.to = (room: string) => target([room]);
    return { emits, reset: () => emits.splice(0, emits.length) };
  }

  return { query, makeOrg, makeUser, makeAgent, makeConversation, call, cleanup, spyEmits };
}

export interface Emitted {
  rooms: string[];
  event: string;
  payload: Record<string, unknown>;
}

interface FakeTarget {
  to: (room: string) => FakeTarget;
  emit: (event: string, payload: Record<string, unknown>) => boolean;
}

export const errorCode = (r: CallResult): string | undefined => (r.json['error'] as { code?: string } | undefined)?.code;
