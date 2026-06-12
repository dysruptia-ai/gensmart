"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebSocket = initWebSocket;
exports.getIO = getIO;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("./env");
let io = null;
function initWebSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: env_1.env.FRONTEND_URL,
            credentials: true,
        },
        path: '/socket.io',
    });
    // JWT auth middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token ??
            socket.handshake.query['token'];
        if (!token) {
            next(new Error('Authentication required'));
            return;
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
            socket.data['userId'] = payload.userId;
            socket.data['orgId'] = payload.orgId;
            socket.data['role'] = payload.role;
            next();
        }
        catch {
            next(new Error('Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        const orgId = socket.data['orgId'];
        socket.join(`org:${orgId}`);
        console.log(`[ws] Client connected: ${socket.id} (org: ${orgId})`);
        socket.on('disconnect', () => {
            console.log(`[ws] Client disconnected: ${socket.id}`);
        });
        // Join a specific conversation room for real-time updates
        socket.on('conversation:join', (conversationId) => {
            socket.join(`conv:${conversationId}`);
        });
        socket.on('conversation:leave', (conversationId) => {
            socket.leave(`conv:${conversationId}`);
        });
    });
    return io;
}
function getIO() {
    if (!io) {
        throw new Error('WebSocket server not initialized. Call initWebSocket() first.');
    }
    return io;
}
//# sourceMappingURL=websocket.js.map