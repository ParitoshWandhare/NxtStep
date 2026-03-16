// ============================================================
// NxtStep — Routes (all in one file)
// ============================================================

import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { validate, 
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
  startInterviewSchema, submitAnswerSchema, proctoringEventSchema,
  newsFeedbackSchema, recommendFeedbackSchema, updateSettingsSchema, newsQuerySchema
} from '../middleware/validate';
import { authLimiter, passwordResetLimiter, interviewLimiter } from '../middleware/rateLimiter';
import * as ctrl from '../controllers/index';

// ── Auth ─────────────────────────────────────────────────────
export const authRouter = Router();
authRouter.post('/register', authLimiter, validate(registerSchema), ctrl.register);
authRouter.post('/login', authLimiter, validate(loginSchema), ctrl.login);
authRouter.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
authRouter.post('/reset-password', passwordResetLimiter, validate(resetPasswordSchema), ctrl.resetPassword);
authRouter.get('/me', authenticate, ctrl.getProfile);
authRouter.patch('/me', authenticate, validate(updateSettingsSchema), ctrl.updateSettings);

// ── Interview ─────────────────────────────────────────────────
export const interviewRouter = Router();
interviewRouter.use(authenticate);
interviewRouter.post('/start', interviewLimiter, validate(startInterviewSchema), ctrl.startInterview);
interviewRouter.get('/', ctrl.getUserSessions);
interviewRouter.get('/:sessionId', ctrl.getSession);
interviewRouter.get('/:sessionId/status', ctrl.getSessionStatus);
interviewRouter.post('/:sessionId/answer', validate(submitAnswerSchema), ctrl.submitAnswer);
interviewRouter.post('/:sessionId/proctoring', validate(proctoringEventSchema), ctrl.recordProctoringEvent);

// ── Scores ────────────────────────────────────────────────────
export const scoresRouter = Router();
scoresRouter.use(authenticate);
scoresRouter.get('/', ctrl.getUserScorecards);
scoresRouter.get('/:sessionId', ctrl.getScorecard);

// ── Recommendations ───────────────────────────────────────────
export const recommendationsRouter = Router();
recommendationsRouter.use(authenticate);
recommendationsRouter.get('/:sessionId', ctrl.getRecommendations);
recommendationsRouter.post('/:sessionId/feedback', validate(recommendFeedbackSchema), ctrl.submitRoleFeedback);

// ── News ─────────────────────────────────────────────────────
export const newsRouter = Router();
newsRouter.get('/', optionalAuthenticate, validate(newsQuerySchema, 'query'), ctrl.getNewsFeed);
newsRouter.get('/trending', ctrl.getTrendingNews);
newsRouter.post('/feedback', authenticate, validate(newsFeedbackSchema), ctrl.submitNewsFeedback);

// ── Health ────────────────────────────────────────────────────
export const healthRouter = Router();
healthRouter.get('/', ctrl.healthCheck);
