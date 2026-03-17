// ============================================================
// NxtStep — Validation Middleware (FIXED)
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, target: ValidationTarget = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: errors },
      });
      return;
    }
    req[target] = result.data;
    next();
  };

// ─────────────────────────────────────────────────────────────
// Content-Type resilience middleware
//
// Handles three cases where express.json() won't parse the body:
//
//  Case 1 — Content-Type: text/plain, body is a raw JSON string
//           req.body === '{"name":"Paritosh"}'
//
//  Case 2 — Content-Type omitted entirely, express leaves body
//           as a Buffer or raw string
//
//  Case 3 — Content-Type: application/x-www-form-urlencoded but
//           the actual payload is JSON (Postman "Text" mode sends
//           this as text/plain which express.urlencoded ignores,
//           leaving req.body as the raw string)
//
// In all cases: if req.body looks like a JSON object/array string,
// parse it. Otherwise leave it alone so Zod reports the real error.
// ─────────────────────────────────────────────────────────────
export const parseBodyIfNeeded = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const body = req.body;

  // Already parsed by express.json() — nothing to do
  if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return next();
  }

  // Convert Buffer to string first
  const raw: string = Buffer.isBuffer(body)
    ? body.toString('utf8')
    : typeof body === 'string'
    ? body
    : '';

  const trimmed = raw.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      req.body = JSON.parse(trimmed);
    } catch {
      // Leave as-is; Zod validation will surface the error clearly
    }
  }

  next();
};

// ── Schemas ──────────────────────────────────────────────────
import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 chars').max(100),
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 chars')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  rolePreferences: z.array(z.string()).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 chars')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
});

export const verifyEmailSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const startInterviewSchema = z.object({
  role: z.string().min(1, 'Role required').max(100),
  difficulty: z.enum(['junior', 'mid', 'senior']).optional().default('mid'),
  topics: z.array(z.string()).max(5).optional(),
  customJobDescription: z.string().max(2000).optional(),
});

export const submitAnswerSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().min(1, 'Answer required').max(5000),
  answerAudioUrl: z.string().url().optional(),
  durationMs: z.number().int().positive().optional(),
});

export const proctoringEventSchema = z.object({
  eventType: z.enum(['tab_switch', 'face_missing', 'multiple_faces', 'termination']),
  timestamp: z.number(),
  details: z.record(z.unknown()).optional(),
});

export const newsFeedbackSchema = z.object({
  articleId: z.string().min(1),
  action: z.enum(['click', 'save', 'share', 'dismiss']),
});

export const recommendFeedbackSchema = z.object({
  roleTitle: z.string().min(1),
  roleCategory: z.string().min(1),
  roleLevel: z.string().min(1),
  signal: z.enum(['relevant', 'not_relevant', 'applied', 'saved']),
  matchScore: z.number().min(0).max(1),
});

export const customRecommendSchema = z.object({
  skills: z.array(z.string()).min(1).max(30),
  preferredLevel: z.enum(['junior', 'mid', 'senior']).optional(),
  preferredCategories: z.array(z.string()).max(5).optional(),
});

export const updateSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  rolePreferences: z.array(z.string()).max(10).optional(),
  interests: z.array(z.string()).max(20).optional(),
});

export const newsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.enum(['tech', 'business', 'finance', 'ai', 'startups', 'all']).default('all'),
});