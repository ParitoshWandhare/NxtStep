// ============================================================
// NxtStep — Redis Configuration
// Connection management with graceful degradation:
// if Redis is unavailable, caching silently no-ops.
// ============================================================

import { createClient } from 'redis';
import { env } from './env';
import { logger } from '../utils/logger';

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient;
let isConnected = false;

const createRedisClient = (): RedisClient => {
  const client = createClient({
    url: env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis: Max reconnection attempts reached');
          return new Error('Redis max retries exceeded');
        }
        const delay = Math.min(retries * 100, 5000);
        logger.warn(`Redis reconnecting... attempt ${retries + 1} (delay: ${delay}ms)`);
        return delay;
      },
      connectTimeout: 10_000,
    },
    pingInterval: 30_000,
  });

  client.on('connect', () => { isConnected = true; logger.info('✅ Redis connected'); });
  client.on('ready', () => { isConnected = true; });
  client.on('error', (err) => {
    isConnected = false;
    if (err.message?.includes('ECONNREFUSED')) {
      logger.warn('Redis connection refused — caching disabled');
    } else {
      logger.error('Redis error:', err.message);
    }
  });
  client.on('reconnecting', () => { isConnected = false; logger.warn('Redis reconnecting...'); });
  client.on('end', () => { isConnected = false; });

  return client;
};

export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createRedisClient();
    await redisClient.connect();
  } catch (err) {
    logger.error('Failed to connect Redis:', (err as Error).message);
    if (env.NODE_ENV !== 'production') {
      logger.warn('⚠️  Running without Redis (dev mode)');
    }
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient && isConnected) {
    try {
      await redisClient.quit();
      logger.info('Redis disconnected gracefully');
    } catch (err) {
      logger.error('Error disconnecting Redis:', err);
    }
  }
};

// ─── Safe wrappers — never throw ──────────────────────────────

export const safeRedisGet = async (key: string): Promise<string | null> => {
  try {
    if (!redisClient || !isConnected) return null;
    return await redisClient.get(key);
  } catch { return null; }
};

export const safeRedisSet = async (
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<boolean> => {
  try {
    if (!redisClient || !isConnected) return false;
    if (ttlSeconds) {
      await redisClient.setEx(key, ttlSeconds, value);
    } else {
      await redisClient.set(key, value);
    }
    return true;
  } catch { return false; }
};

export const safeRedisDel = async (key: string): Promise<boolean> => {
  try {
    if (!redisClient || !isConnected) return false;
    await redisClient.del(key);
    return true;
  } catch { return false; }
};

export const safeRedisKeys = async (pattern: string): Promise<string[]> => {
  try {
    if (!redisClient || !isConnected) return [];
    return await redisClient.keys(pattern);
  } catch { return []; }
};

export const getRedisStatus = () => ({
  isConnected,
  url: env.REDIS_URL.replace(/:[^:@]*@/, ':***@'),
});

export { redisClient };
