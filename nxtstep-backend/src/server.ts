// ============================================================
// NxtStep — Server Entry Point
// ============================================================

import 'dotenv/config';
import http from 'http';
import { app } from './app';
import { connectDB } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { initSocket } from './sockets/index';
import { closeAllQueues, addIngestNewsJob } from './queues';
import { closeAllWorkers } from './workers/index';
import { env } from './config/env';
import { logger } from './utils/logger';

let httpServer: http.Server;

const start = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Connect to Redis (non-fatal — safe wrappers handle degraded state)
  // try {
  //   await redisClient.connect();
  //   logger.info('Redis connected');
  // } catch (err) {
  //   logger.warn({ err }, 'Redis unavailable — running without cache');
  // }
  await connectRedis();

  // 3. Create HTTP server
  httpServer = http.createServer(app);

  // 4. Init Socket.IO
  initSocket(httpServer);

  // 5. Start workers (lazy import to ensure connections are ready)
  if (env.ENABLE_WORKERS !== false) {
    await import('./workers/index');
    logger.info('Workers started');
  }

  // 6. Schedule news ingestion
  if (env.ENABLE_NEWS_INGESTION !== false) {
    await addIngestNewsJob();
    logger.info('News ingestion scheduled');
  }

  // 7. Listen
  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `NxtStep server running`);
  });
};

// ── Graceful Shutdown ─────────────────────────────────────────
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');

  // Stop accepting new connections
  httpServer?.close(async () => {
    logger.info('HTTP server closed');
  });

  try {
    await Promise.allSettled([
      closeAllWorkers(),
      closeAllQueues(),
      // redisClient.quit(),
      disconnectRedis(),
    ]);
  } catch (err) {
    logger.warn({ err }, 'Error during graceful shutdown');
  }

  const { default: mongoose } = await import('mongoose');
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  if (env.NODE_ENV === 'production') process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
