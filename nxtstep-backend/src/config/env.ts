// ============================================================
// NxtStep — Environment Configuration
// ============================================================

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default('1').transform(Number),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_EPHEMERAL_EXPIRES_IN: z.string().default('2h'),

  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: z.string().default('mistralai/mistral-7b-instruct:free'),

  STT_PROVIDER: z.string().default('webspeech'),
  TTS_PROVIDER: z.string().default('browser'),

  GNEWS_API_KEY: z.string().optional().default(''),
  NEWS_API_KEY: z.string().optional().default(''),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('noreply@nxtstep.app'),

  MAX_FILE_SIZE_MB: z.string().default('10').transform(Number),
  UPLOAD_DIR: z.string().default('./uploads'),

  // ── Scoring Weights ─────────────────────────
  SCORE_WEIGHT_TECHNICAL: z.string().default('0.35').transform(Number),
  SCORE_WEIGHT_PROBLEM_SOLVING: z.string().default('0.25').transform(Number),
  SCORE_WEIGHT_COMMUNICATION: z.string().default('0.20').transform(Number),
  SCORE_WEIGHT_CONFIDENCE: z.string().default('0.10').transform(Number),
  SCORE_WEIGHT_CONCEPT_DEPTH: z.string().default('0.10').transform(Number),

  // ── Recommendation Weights ──────────────────
  RECOMMEND_WEIGHT_SKILL: z.string().default('0.50').transform(Number),
  RECOMMEND_WEIGHT_LEVEL: z.string().default('0.20').transform(Number),
  RECOMMEND_WEIGHT_PREFERENCE: z.string().default('0.15').transform(Number),
  RECOMMEND_WEIGHT_RESUME: z.string().default('0.15').transform(Number),

  TAB_SWITCH_WARN_THRESHOLD: z.string().default('3').transform(Number),
  TAB_SWITCH_TERMINATE_THRESHOLD: z.string().default('5').transform(Number),

  MAX_QUESTIONS_PER_SESSION: z.string().default('10').transform(Number),
  MAX_FOLLOWUPS_PER_QUESTION: z.string().default('2').transform(Number),

  NEWS_INGEST_INTERVAL_MS: z.string().default('600000').transform(Number),

  // ── Feature Flags ─────────────────────────────
  ENABLE_WORKERS: z.string().default('true').transform(v => v === 'true'),
  ENABLE_NEWS_INGESTION: z.string().default('true').transform(v => v === 'true'),

    // ── Rate Limiting ─────────────────────────────
  RATE_LIMIT_GLOBAL_MAX: z.string().default('200').transform(Number),
  RATE_LIMIT_AUTH_MAX: z.string().default('20').transform(Number),
  RATE_LIMIT_INTERVIEW_MAX: z.string().default('5').transform(Number),

  BCRYPT_SALT_ROUNDS: z.string().default('12').transform(Number),
  PASSWORD_RESET_EXPIRES_HOURS: z.string().default('1').transform(Number),

  // ── Workers ─────────────────────────────
  WORKER_CONCURRENCY: z.string().default('4').transform(Number),

  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid env config');
  parsed.error.errors.forEach(e =>
    console.error(`[${e.path.join('.')}] ${e.message}`)
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;