// ============================================================
// NxtStep — Database Configuration
// MongoDB connection with retry logic, health monitoring,
// connection pooling, and graceful shutdown.
// ============================================================

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
        `❌ MongoDB connection attempt ${retryCount}/${MAX_RETRIES}: ${(error as Error).message}`,
      );

      if (retryCount >= MAX_RETRIES) {
        logger.error('MongoDB connection failed after max retries');
        if (env.NODE_ENV === 'production') process.exit(1);
        return;
      }

      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }
};

mongoose.connection.on('connected', () => { isConnected = true; logger.info('MongoDB connection established'); });
mongoose.connection.on('disconnected', () => { isConnected = false; logger.warn('MongoDB disconnected'); });
mongoose.connection.on('reconnected', () => { isConnected = true; logger.info('MongoDB reconnected'); });
mongoose.connection.on('error', (err) => { logger.error('MongoDB error:', err.message); isConnected = false; });

export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) return;
  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB connection closed gracefully');
  } catch (err) {
    logger.error('Error closing MongoDB:', err);
  }
};

export const getConnectionStatus = () => ({
  isConnected,
  readyState: mongoose.connection.readyState,
  host: mongoose.connection.host,
  name: mongoose.connection.name,
});
