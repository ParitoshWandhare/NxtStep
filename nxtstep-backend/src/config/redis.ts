import { createClient } from 'redis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redisClient = createClient({ url: env.REDIS_URL });

redisClient.on('error', (err) => logger.error('Redis error:', err));
redisClient.on('connect', () => logger.info('✅ Redis connected'));
redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

export const connectRedis = async (): Promise<void> => {
  await redisClient.connect();
};