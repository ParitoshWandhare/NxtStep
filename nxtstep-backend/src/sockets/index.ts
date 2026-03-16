// ============================================================
// NxtStep — Socket.IO Server
// Real-time interview events: question ready, evaluation done, etc.
// ============================================================

import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { logger } from '../utils/logger';
import { env } from '../config/env';

let io: IOServer | null = null;

export const initSocket = (httpServer: HttpServer): IOServer => {
  io = new IOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware for socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = verifyToken<JwtPayload>(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as JwtPayload;
    logger.debug({ userId: user.userId, socketId: socket.id }, 'Socket connected');

    // Join user-specific room
    socket.join(`user:${user.userId}`);

    // Join session room when interview starts
    socket.on('join:session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      logger.debug({ userId: user.userId, sessionId }, 'Joined session room');
    });

    socket.on('leave:session', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: user.userId, socketId: socket.id, reason }, 'Socket disconnected');
    });

    socket.on('error', (err) => {
      logger.warn({ err, userId: user.userId }, 'Socket error');
    });
  });

  logger.info('Socket.IO initialized');
  return io;
};

// ── Emit helpers (called from workers/services) ───────────────
export const emitToUser = (userId: string, event: string, data: unknown) => {
  io?.to(`user:${userId}`).emit(event, data);
};

export const emitToSession = (sessionId: string, event: string, data: unknown) => {
  io?.to(`session:${sessionId}`).emit(event, data);
};

// Events emitted by workers:
export const emitQuestionReady = (sessionId: string, question: unknown) =>
  emitToSession(sessionId, 'question:ready', question);

export const emitEvaluationComplete = (sessionId: string, evaluation: unknown) =>
  emitToSession(sessionId, 'evaluation:complete', evaluation);

export const emitScorecardReady = (sessionId: string, scorecard: unknown) =>
  emitToSession(sessionId, 'scorecard:ready', scorecard);

export const emitRecommendationsReady = (sessionId: string, recommendations: unknown) =>
  emitToSession(sessionId, 'recommendations:ready', recommendations);

export const emitSessionTerminated = (sessionId: string, reason: string) =>
  emitToSession(sessionId, 'session:terminated', { reason });

export const getIO = (): IOServer | null => io;
