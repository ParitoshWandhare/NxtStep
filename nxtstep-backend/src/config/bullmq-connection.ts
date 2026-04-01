// ============================================================
// NxtStep — Shared BullMQ IORedis Connection
// A single IORedis instance shared across all queues and workers
// to prevent connection pool exhaustion.
// ============================================================

import IORedis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const sharedBullConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('BullMQ Redis: max reconnection attempts reached');
      return null; // stop retrying
    }
    const delay = Math.min(times * 100, 5000);
    logger.warn(`BullMQ Redis reconnecting... attempt ${times} (delay: ${delay}ms)`);
    return delay;
  },
});

sharedBullConnection.on('connect', () => {
  logger.info('✅ BullMQ Redis connected');
});

sharedBullConnection.on('error', (err) => {
  if (err.message?.includes('ECONNREFUSED')) {
    logger.warn('BullMQ Redis connection refused — queues/workers degraded');
  } else {
    logger.error('BullMQ Redis error:', err.message);
  }
});

sharedBullConnection.on('reconnecting', () => {
  logger.warn('BullMQ Redis reconnecting...');
});

export const closeBullConnection = async (): Promise<void> => {
  try {
    await sharedBullConnection.quit();
    logger.info('BullMQ Redis connection closed gracefully');
  } catch (err) {
    logger.error('Error closing BullMQ Redis connection:', err);
  }
};