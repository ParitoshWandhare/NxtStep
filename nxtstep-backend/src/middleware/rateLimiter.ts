import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — try again later' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts — try again later' },
});

export const interviewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { success: false, message: 'Interview event rate limit exceeded' },
});