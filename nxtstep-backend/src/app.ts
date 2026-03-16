// ============================================================
// NxtStep — Express App
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import {
  authRouter,
  interviewRouter,
  scoresRouter,
  recommendationsRouter,
  newsRouter,
  healthRouter,
} from './routes/index';

const app = express();

// ── Security ─────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Compression ───────────────────────────────────────────────
app.use(compression());

// ── Request logging ───────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// ── Rate limiting ─────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/recommend', recommendationsRouter);
app.use('/api/news', newsRouter);
app.use('/api/health', healthRouter);

// ── 404 & Error handlers ─────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
