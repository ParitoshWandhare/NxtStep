import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// ── Helper to create consistent limiter config ────────────────

const createLimiter = (max: number, windowMs: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message },
    skipSuccessfulRequests: false,
    // Use X-Forwarded-For when behind a proxy
    keyGenerator: (req) =>
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      'unknown',
  });

// ── 15-minute window limiters ─────────────────────────────────

export const globalLimiter = createLimiter(
  env.RATE_LIMIT_GLOBAL_MAX,
  15 * 60 * 1000,
  'Too many requests — please try again in 15 minutes',
);

export const authLimiter = createLimiter(
  env.RATE_LIMIT_AUTH_MAX,
  15 * 60 * 1000,
  'Too many authentication attempts — please try again in 15 minutes',
);

// ── 1-minute window limiter for interview events ──────────────

export const interviewLimiter = createLimiter(
  env.RATE_LIMIT_INTERVIEW_MAX,
  60 * 1000,
  'Interview event rate limit exceeded — slow down',
);

// ── Strict limiter for password reset ─────────────────────────

export const passwordResetLimiter = createLimiter(
  5,
  60 * 60 * 1000, // 5 per hour
  'Too many password reset requests — please try again in an hour',
);