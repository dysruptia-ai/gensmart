import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';

let io: SocketIOServer | null = null;

export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
    path: '/socket.io',
  });

  // JWT auth middleware
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as { token?: string }).token ??
      (socket.handshake.query['token'] as string | undefined);

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        userId: string;
        orgId: string;
        role: string;
        email: string;
      };
      socket.data['userId'] = payload.userId;
      socket.data['orgId'] = payload.orgId;
      socket.data['role'] = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const orgId = socket.data['orgId'] as string;
    socket.join(`org:${orgId}`);
    console.log(`[ws] Client connected: ${socket.id} (org: ${orgId})`);

    socket.on('disconnect', () => {
      console.log(`[ws] Client disconnected: ${socket.id}`);
    });

    // Join a specific conversation room for real-time updates
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('WebSocket server not initialized. Call initWebSocket() first.');
  }
  return io;
}
