import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_EPHEMERAL_EXPIRES_IN: z.string().default('2h'),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: z.string().default('mistralai/mistral-7b-instruct:free'),

  STT_PROVIDER: z.string().default('webspeech'),
  TTS_PROVIDER: z.string().default('browser'),

  GNEWS_API_KEY: z.string().optional(),
  NEWSAPI_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@nxtstep.app'),

  CLIENT_URL: z.string().default('http://localhost:5173'),

  MAX_FILE_SIZE_MB: z.string().default('10').transform(Number),
  UPLOAD_DIR: z.string().default('./uploads'),

  // Scoring weights
  WEIGHT_TECHNICAL: z.string().default('0.35').transform(Number),
  WEIGHT_PROBLEM_SOLVING: z.string().default('0.25').transform(Number),
  WEIGHT_COMMUNICATION: z.string().default('0.20').transform(Number),
  WEIGHT_CONFIDENCE: z.string().default('0.10').transform(Number),
  WEIGHT_CONCEPT_DEPTH: z.string().default('0.10').transform(Number),

  // Proctoring
  TAB_SWITCH_WARN_THRESHOLD: z.string().default('3').transform(Number),
  TAB_SWITCH_TERMINATE_THRESHOLD: z.string().default('5').transform(Number),
  CAMERA_WARN_SECONDS: z.string().default('10').transform(Number),
  CAMERA_LOG_SECONDS: z.string().default('30').transform(Number),
  CAMERA_TERMINATE_SECONDS: z.string().default('60').transform(Number),

  // Interview
  MAX_QUESTIONS_PER_SESSION: z.string().default('10').transform(Number),
  MAX_FOLLOWUPS_PER_QUESTION: z.string().default('2').transform(Number),
  CONFIDENCE_FOLLOWUP_THRESHOLD: z.string().default('5').transform(Number),
  CONCEPT_DEPTH_FOLLOWUP_THRESHOLD: z.string().default('5').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  parsed.error.errors.forEach((err) => {
    console.error(`  ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;