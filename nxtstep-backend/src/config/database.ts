import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const MONGO_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  connectTimeoutMS: 10_000,
  maxPoolSize: env.NODE_ENV === 'production' ? 20 : 5,
  minPoolSize: 2,
  heartbeatFrequencyMS: 10_000,
  retryWrites: true,
  retryReads: true,
};

let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5_000;

export const connectDB = async (): Promise<void> => {
  if (isConnected) return;

  while (retryCount < MAX_RETRIES) {
    try {
      await mongoose.connect(env.MONGO_URI, MONGO_OPTIONS);
      isConnected = true;
      retryCount = 0;
      logger.info(`✅ MongoDB connected: ${mongoose.connection.host}`);
      return;
    } catch (error) {
      retryCount++;
      logger.error(
        `❌ MongoDB connection attempt ${retryCount}/${MAX_RETRIES} failed:`,
        error instanceof Error ? error.message : error,
      );

      if (retryCount >= MAX_RETRIES) {
        logger.error('MongoDB connection failed after maximum retries. Exiting.');
        process.exit(1);
      }

      logger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

// ── Connection lifecycle events ───────────────────────────────

mongoose.connection.on('connected', () => {
  isConnected = true;
  logger.info('MongoDB connection established');
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  logger.info('MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err.message);
  isConnected = false;
});

// ── Graceful shutdown ─────────────────────────────────────────

export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) return;
  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB connection closed gracefully');
  } catch (err) {
    logger.error('Error closing MongoDB connection:', err);
  }
};

export const getConnectionStatus = () => ({
  isConnected,
  readyState: mongoose.connection.readyState,
  host: mongoose.connection.host,
  name: mongoose.connection.name,
});