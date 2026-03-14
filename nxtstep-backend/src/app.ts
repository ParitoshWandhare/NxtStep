import './config/env'; // Must be first — validates environment
import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { connectDB, disconnectDB } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { initSockets } from './sockets';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimiter';
import { env } from './config/env';
import { logger } from './utils/logger';

// ── App setup ─────────────────────────────────────────────────

const app: Application = express();
const httpServer = http.createServer(app);

// ── Trust proxy (for platforms behind load balancers) ─────────
app.set('trust proxy', env.TRUST_PROXY);

// ── Security headers ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false, // Allow interview embeds
  }),
);

// ── CORS ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, same-origin)
      if (!origin) return callback(null, true);
      const allowed = env.CLIENT_URL.split(',').map((u) => u.trim());
      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Request-Id'],
    maxAge: 86400, // Preflight cache: 24 hours
  }),
);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Request logging ───────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health', // Don't log health checks
      },
      customLogLevel: (_, res) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} → ${res.statusCode}`,
    }),
  );
}

// ── Rate limiting ─────────────────────────────────────────────
app.use(globalLimiter);

// ── Health check (no auth, no rate limit) ────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    version: process.env.npm_package_version ?? '1.0.0',
    uptime: Math.floor(process.uptime()),
  });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 + Error handling ──────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Bootstrap ─────────────────────────────────────────────────
const start = async (): Promise<void> => {
  try {
    await connectDB();
    await connectRedis();

    initSockets(httpServer);

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 NxtStep API running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`📡 WebSocket ready`);
      logger.info(`🏥 Health: http://localhost:${env.PORT}/health`);
    });
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
};

// ── Graceful shutdown ──────────────────────────────────────────
let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Shutting down gracefully...`);

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed');

    try {
      await disconnectDB();
      await disconnectRedis();
      logger.info('All connections closed. Exiting.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force exit after 15 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timeout. Force exiting.');
    process.exit(1);
  }, 15_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled rejections — log and exit in production
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection');
  if (env.NODE_ENV === 'production') {
    shutdown('unhandledRejection');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught Exception');
  shutdown('uncaughtException');
});

start();

export { app, httpServer };