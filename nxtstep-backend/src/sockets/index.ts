import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyToken, EphemeralTokenPayload } from '../utils/jwt';
import { logger } from '../utils/logger';

let io: SocketIOServer;

// Map: sessionId -> Set of socket ids
const sessionRooms = new Map<string, Set<string>>();

export const initSockets = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware for interview session sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyToken<EphemeralTokenPayload>(token);
      socket.data.sessionId = payload.sessionId;
      socket.data.userId = payload.userId;
      next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { sessionId, userId } = socket.data as { sessionId: string; userId: string };
    logger.debug(`Socket connected: ${socket.id} | session: ${sessionId} | user: ${userId}`);

    // Join session room
    socket.join(`session:${sessionId}`);

    if (!sessionRooms.has(sessionId)) sessionRooms.set(sessionId, new Set());
    sessionRooms.get(sessionId)!.add(socket.id);

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
      sessionRooms.get(sessionId)?.delete(socket.id);
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

// ─── Notification Emitters ────────────────────────────────────────────────────

export const notifyQuestionReady = (sessionId: string, question: unknown) => {
  getIO().to(`session:${sessionId}`).emit('question:ready', { question });
};

export const notifyEvaluationReady = (sessionId: string, evaluation: unknown) => {
  getIO().to(`session:${sessionId}`).emit('evaluation:ready', { evaluation });
};

export const notifyFollowUpReady = (sessionId: string, followUp: unknown) => {
  getIO().to(`session:${sessionId}`).emit('followup:ready', { followUp });
};

export const notifyScorecardReady = (sessionId: string, scorecard: unknown) => {
  getIO().to(`session:${sessionId}`).emit('scorecard:ready', { scorecard });
};

export const notifyRecommendationsReady = (sessionId: string, recommendations: unknown) => {
  getIO().to(`session:${sessionId}`).emit('recommendations:ready', { recommendations });
};

export const notifyInterviewTerminated = (sessionId: string, reason: string) => {
  getIO().to(`session:${sessionId}`).emit('interview:terminated', { reason });
};