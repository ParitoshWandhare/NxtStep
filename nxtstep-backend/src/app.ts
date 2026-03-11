import './config/env'; // Validate environment first
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { initSockets } from './sockets';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimiter';
import { env } from './config/env';
import { logger } from './utils/logger';

const app = express();
const httpServer = http.createServer(app);

// ─── Trust proxy (Render/Railway behind load balancer) ────────────────────────
app.set('trust proxy', 1);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── Request parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }));
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  await connectRedis();

  // Initialize Socket.IO
  initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀 NxtStep API running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📡 WebSocket ready`);
    logger.info(`🏥 Health: http://localhost:${env.PORT}/health`);
  });
};

start().catch((err) => {
  logger.error('Startup failed:', err);
  process.exit(1);
});

export { app, httpServer };