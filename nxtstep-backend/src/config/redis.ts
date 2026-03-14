import { createClient, RedisClientType } from 'redis';
import { env } from './env';
import { logger } from '../utils/logger';

let redisClient: ReturnType<typeof createClient>;
let isConnected = false;

const createRedisClient = () => {
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
    pingInterval: 30_000,  // Keep-alive every 30 seconds
  });

  client.on('connect', () => {
    isConnected = true;
    logger.info('✅ Redis connected');
  });

  client.on('ready', () => {
    isConnected = true;
    logger.debug('Redis ready');
  });

  client.on('error', (err) => {
    isConnected = false;
    // Don't crash on Redis errors — gracefully degrade
    if (err.message.includes('ECONNREFUSED')) {
      logger.warn('Redis connection refused — caching disabled');
    } else {
      logger.error('Redis error:', err.message);
    }
  });

  client.on('reconnecting', () => {
    isConnected = false;
    logger.warn('Redis reconnecting...');
  });

  client.on('end', () => {
    isConnected = false;
    logger.warn('Redis connection closed');
  });

  return client;
};

export const connectRedis = async (): Promise<void> => {
  try {
    redisClient = createRedisClient();
    await redisClient.connect();
  } catch (err) {
    logger.error('Failed to connect to Redis:', err instanceof Error ? err.message : err);
    // In production, we might want to continue without Redis (degraded mode)
    if (env.NODE_ENV === 'production') {
      logger.warn('⚠️  Running without Redis — caching disabled');
    }
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient && isConnected) {
    await redisClient.quit();
    logger.info('Redis disconnected gracefully');
  }
};

// ── Safe Redis wrapper — never throws, degrades gracefully ────

export const safeRedisGet = async (key: string): Promise<string | null> => {
  try {
    if (!redisClient || !isConnected) return null;
    return await redisClient.get(key);
  } catch {
    return null;
  }
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
  } catch {
    return false;
  }
};

export const safeRedisDel = async (key: string): Promise<boolean> => {
  try {
    if (!redisClient || !isConnected) return false;
    await redisClient.del(key);
    return true;
  } catch {
    return false;
  }
};

export const getRedisStatus = () => ({
  isConnected,
  url: env.REDIS_URL.replace(/:[^:@]*@/, ':***@'), // Mask password in logs
});

// Export the client — callers should use safeRedis* wrappers
export { redisClient };