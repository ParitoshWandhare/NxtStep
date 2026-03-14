import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // ── Server ──────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default('1').transform(Number),

  // ── Database ────────────────────────────────────────────────
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  // ── Redis ───────────────────────────────────────────────────
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ── JWT ─────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_EPHEMERAL_EXPIRES_IN: z.string().default('2h'),

  // ── AI ──────────────────────────────────────────────────────
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: z.string().default('mistralai/mistral-7b-instruct:free'),

  // ── Speech ──────────────────────────────────────────────────
  STT_PROVIDER: z.string().default('webspeech'),
  TTS_PROVIDER: z.string().default('browser'),
  DEEPGRAM_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),

  // ── News ────────────────────────────────────────────────────
  GNEWS_API_KEY: z.string().optional(),
  NEWSAPI_KEY: z.string().optional(),

  // ── Email ───────────────────────────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@nxtstep.app'),

  // ── Files ───────────────────────────────────────────────────
  MAX_FILE_SIZE_MB: z.string().default('10').transform(Number),
  UPLOAD_DIR: z.string().default('./uploads'),

  // ── Scoring Weights ─────────────────────────────────────────
  WEIGHT_TECHNICAL: z.string().default('0.35').transform(Number),
  WEIGHT_PROBLEM_SOLVING: z.string().default('0.25').transform(Number),
  WEIGHT_COMMUNICATION: z.string().default('0.20').transform(Number),
  WEIGHT_CONFIDENCE: z.string().default('0.10').transform(Number),
  WEIGHT_CONCEPT_DEPTH: z.string().default('0.10').transform(Number),

  // ── Recommendation Weights ───────────────────────────────────
  WEIGHT_SKILL_MATCH: z.string().default('0.50').transform(Number),
  WEIGHT_LEVEL_MATCH: z.string().default('0.20').transform(Number),
  WEIGHT_PREFERENCE_MATCH: z.string().default('0.15').transform(Number),
  WEIGHT_RESUME_MATCH: z.string().default('0.15').transform(Number),

  // ── Proctoring ──────────────────────────────────────────────
  TAB_SWITCH_WARN_THRESHOLD: z.string().default('3').transform(Number),
  TAB_SWITCH_TERMINATE_THRESHOLD: z.string().default('5').transform(Number),
  CAMERA_WARN_SECONDS: z.string().default('10').transform(Number),
  CAMERA_LOG_SECONDS: z.string().default('30').transform(Number),
  CAMERA_TERMINATE_SECONDS: z.string().default('60').transform(Number),

  // ── Interview ────────────────────────────────────────────────
  MAX_QUESTIONS_PER_SESSION: z.string().default('10').transform(Number),
  MAX_FOLLOWUPS_PER_QUESTION: z.string().default('2').transform(Number),
  CONFIDENCE_FOLLOWUP_THRESHOLD: z.string().default('5').transform(Number),
  CONCEPT_DEPTH_FOLLOWUP_THRESHOLD: z.string().default('5').transform(Number),

  // ── Rate Limiting ────────────────────────────────────────────
  RATE_LIMIT_GLOBAL_MAX: z.string().default('200').transform(Number),
  RATE_LIMIT_AUTH_MAX: z.string().default('20').transform(Number),
  RATE_LIMIT_INTERVIEW_MAX: z.string().default('60').transform(Number),

  // ── Logging ──────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // ── Monitoring ───────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),

  // ── Worker ───────────────────────────────────────────────────
  NEWS_INGESTION_INTERVAL_MINUTES: z.string().default('10').transform(Number),
  WORKER_CONCURRENCY_EVALUATE: z.string().default('5').transform(Number),
  WORKER_CONCURRENCY_GENERATE: z.string().default('5').transform(Number),
  WORKER_CONCURRENCY_SCORECARD: z.string().default('3').transform(Number),
  WORKER_CONCURRENCY_RECOMMEND: z.string().default('3').transform(Number),

  // ── Security ─────────────────────────────────────────────────
  BCRYPT_SALT_ROUNDS: z.string().default('12').transform(Number),
  PASSWORD_RESET_EXPIRES_HOURS: z.string().default('1').transform(Number),

  // ── Cache TTLs ───────────────────────────────────────────────
  CACHE_TTL_NEWS_FEED: z.string().default('120').transform(Number),
  CACHE_TTL_TRENDING: z.string().default('300').transform(Number),
  CACHE_TTL_ROLE_ENRICHMENT: z.string().default('86400').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  parsed.error.errors.forEach((err) => {
    console.error(`  [${err.path.join('.')}]: ${err.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

// Validate that scoring weights sum to approximately 1.0
const scoringWeightSum =
  env.WEIGHT_TECHNICAL +
  env.WEIGHT_PROBLEM_SOLVING +
  env.WEIGHT_COMMUNICATION +
  env.WEIGHT_CONFIDENCE +
  env.WEIGHT_CONCEPT_DEPTH;

if (Math.abs(scoringWeightSum - 1.0) > 0.01) {
  console.warn(
    `⚠️  Scoring weights sum to ${scoringWeightSum.toFixed(2)}, expected 1.0. ` +
    `Results may be unexpected.`,
  );
}

const recWeightSum =
  env.WEIGHT_SKILL_MATCH +
  env.WEIGHT_LEVEL_MATCH +
  env.WEIGHT_PREFERENCE_MATCH +
  env.WEIGHT_RESUME_MATCH;

if (Math.abs(recWeightSum - 1.0) > 0.01) {
  console.warn(
    `⚠️  Recommendation weights sum to ${recWeightSum.toFixed(2)}, expected 1.0.`,
  );
}