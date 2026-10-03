import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from './jwt';
import { env } from './env';
import { query } from './database';
import { resolveEffectiveRole } from '../middleware/effective-role';

let io: SocketIOServer | null = null;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_CONVERSATION_ROOMS = 100;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Current role of the user in the organization of the token, from the database: a direct membership,
 * or (sub-account sessions) an owner/admin role in the parent. Same rule as the orgContext middleware.
 * Null when there is none; a database error is a denial, never a permission.
 */
export async function resolveSocketRole(userId: string, orgId: string): Promise<string | null> {
  try {
    const result = await query<{ member_role: string | null; parent_role: string | null }>(
      `SELECT
         (SELECT uo.role FROM user_organizations uo
           WHERE uo.user_id = $1 AND uo.organization_id = $2) AS member_role,
         (SELECT po.role FROM sub_accounts sa
            JOIN user_organizations po
              ON po.organization_id = sa.parent_organization_id AND po.user_id = $1
           WHERE sa.child_organization_id = $2
           ORDER BY CASE po.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
           LIMIT 1) AS parent_role`,
      [userId, orgId]
    );
    const row = result.rows[0];
    return row ? resolveEffectiveRole(row.member_role, row.parent_role) : null;
  } catch (err) {
    console.error('[ws] membership check failed:', (err as Error).message);
    return null;
  }
}

/**
 * Returns the normalized conversation id when it is a UUID that belongs to the socket's
 * organization (the same scope the REST API uses: the org in the access token), else null.
 * A database error is a denial, never a permission.
 */
export async function authorizeConversationJoin(conversationId: unknown, orgId: string): Promise<string | null> {
  if (!isUuid(conversationId)) return null;
  const normalized = conversationId.toLowerCase();
  try {
    const result = await query<{ one: number }>(
      'SELECT 1 AS one FROM conversations WHERE id = $1 AND organization_id = $2',
      [normalized, orgId]
    );
    return result.rows.length > 0 ? normalized : null;
  } catch (err) {
    console.error('[ws] conversation:join authorization failed:', (err as Error).message);
    return null;
  }
}

/** conversation:join / conversation:leave for one socket, with org check and a room cap. */
export function registerConversationRoomHandlers(socket: Socket): void {
  const rooms = new Set<string>();
  const who = () => ({
    userId: socket.data['userId'] as string | undefined,
    orgId: socket.data['orgId'] as string | undefined,
  });

  socket.on('conversation:join', async (conversationId: unknown) => {
    try {
      const { userId, orgId } = who();
      if (!isUuid(conversationId)) {
        console.warn('[ws] Denied conversation:join', { userId, orgId, reason: 'invalid_format' });
        return;
      }
      const candidate = conversationId.toLowerCase();
      if (rooms.has(candidate)) return;
      if (rooms.size >= MAX_CONVERSATION_ROOMS) {
        console.warn('[ws] Denied conversation:join', { userId, orgId, reason: 'room_limit' });
        return;
      }
      const authorized = await authorizeConversationJoin(candidate, orgId ?? '');
      if (!authorized) {
        console.warn('[ws] Denied conversation:join', { userId, orgId, reason: 'not_authorized' });
        return;
      }
      // Re-check: concurrent joins may have filled the cap while the query ran
      if (rooms.size >= MAX_CONVERSATION_ROOMS) {
        console.warn('[ws] Denied conversation:join', { userId, orgId, reason: 'room_limit' });
        return;
      }
      await socket.join(`conv:${authorized}`);
      rooms.add(authorized);
    } catch (err) {
      console.error('[ws] conversation:join failed:', (err as Error).message);
    }
  });

  socket.on('conversation:leave', async (conversationId: unknown) => {
    try {
      if (typeof conversationId !== 'string') return;
      const normalized = conversationId.toLowerCase();
      await socket.leave(`conv:${normalized}`);
      rooms.delete(normalized);
    } catch (err) {
      console.error('[ws] conversation:leave failed:', (err as Error).message);
    }
  });
}

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    path: '/socket.io',
  });

  // JWT auth middleware (the async handshake never throws: every path ends in next())
  const authenticate = async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    const token =
      (socket.handshake.auth as { token?: string }).token ??
      (socket.handshake.query['token'] as string | undefined);

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      // The token only says which organization was asked for: the membership must still exist
      const role = await resolveSocketRole(payload.userId, payload.orgId);
      if (!role) {
        next(new Error('Invalid token'));
        return;
      }
      socket.data['userId'] = payload.userId;
      socket.data['orgId'] = payload.orgId;
      socket.data['role'] = role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  };
  io.use((socket, next) => {
    void authenticate(socket, next);
  });

  io.on('connection', (socket) => {
    const orgId = socket.data['orgId'] as string;
    const userId = socket.data['userId'] as string;
    void Promise.all([socket.join(`org:${orgId}`), socket.join(`user:${userId}`)]).catch((err: unknown) => {
      console.error('[ws] could not join rooms:', (err as Error).message);
    });
    console.log(`[ws] Client connected: ${socket.id} (org: ${orgId})`);

    socket.on('disconnect', () => {
      console.log(`[ws] Client disconnected: ${socket.id}`);
    });

    // Conversation rooms for real-time updates (authorized against the socket's organization)
    registerConversationRoomHandlers(socket);
  });

  return io;
}

/** Disconnects the sockets of one user that are in the room of an organization. Harmless without a server. */
export async function disconnectUserFromOrg(userId: string, orgId: string): Promise<void> {
  if (!io) return;
  try {
    const sockets = await io.in(`org:${orgId}`).fetchSockets();
    for (const s of sockets) {
      if (s.data['userId'] === userId) s.disconnect(true);
    }
  } catch (err) {
    console.error('[ws] disconnectUserFromOrg failed:', (err as Error).message);
  }
}

/** Disconnects every socket in the room of an organization. Harmless without a server. */
export async function disconnectOrg(orgId: string): Promise<void> {
  if (!io) return;
  try {
    io.in(`org:${orgId}`).disconnectSockets(true);
  } catch (err) {
    console.error('[ws] disconnectOrg failed:', (err as Error).message);
  }
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('WebSocket server not initialized. Call initWebSocket() first.');
  }
  return io;
}
