// ============================================================
// NxtStep — Controllers
// ============================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as authService from '../services/authService';
import * as interviewService from '../services/interviewService';
import * as scoringService from '../services/scoringService';
import * as recommendationService from '../services/recommendationService';
import * as newsService from '../services/newsService';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/apiResponse';

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════
export const register = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, rolePreferences } = req.body;
    const result = await authService.registerUser(name, email, password, rolePreferences);
    sendCreated(res, result, 'Account created successfully');
  } catch (err) { next(err); }
};

export const login = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    sendSuccess(res, result, 'Logged in successfully');
  } catch (err) { next(err); }
};

export const forgotPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await authService.forgotPassword(req.body.email);
    // Always return 200 to prevent enumeration
    sendSuccess(res, null, 'If that email exists, a reset link has been sent');
  } catch (err) { next(err); }
};

export const resetPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, null, 'Password reset successfully');
  } catch (err) { next(err); }
};

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getProfile(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) { next(err); }
};

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    sendSuccess(res, user, 'Settings updated');
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// INTERVIEW
// ═══════════════════════════════════════════════════════════════
export const startInterview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, difficulty, topics, customJobDescription } = req.body;
    const result = await interviewService.startInterview(
      req.user!.userId, role, difficulty, topics, customJobDescription
    );
    sendCreated(res, result, 'Interview session started');
  } catch (err) { next(err); }
};

export const getSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await interviewService.getSession(req.params.sessionId, req.user!.userId);
    sendSuccess(res, session);
  } catch (err) { next(err); }
};

export const getSessionStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = await interviewService.getSessionStatus(req.params.sessionId, req.user!.userId);
    sendSuccess(res, status);
  } catch (err) { next(err); }
};

export const submitAnswer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { questionId, answerText, answerAudioUrl, durationMs } = req.body;
    const result = await interviewService.submitAnswer(
      req.params.sessionId, req.user!.userId, questionId, answerText, answerAudioUrl, durationMs
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const recordProctoringEvent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { eventType, timestamp, details } = req.body;
    const result = await interviewService.recordProctoringEvent(
      req.params.sessionId, req.user!.userId, eventType, timestamp, details
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const getUserSessions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await interviewService.getUserSessions(req.user!.userId, page, limit);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// SCORES
// ═══════════════════════════════════════════════════════════════
export const getScorecard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scorecard = await scoringService.getScorecard(req.params.sessionId, req.user!.userId);
    sendSuccess(res, scorecard);
  } catch (err) { next(err); }
};

export const getUserScorecards = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await scoringService.getUserScorecards(req.user!.userId, page, limit);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════
export const getRecommendations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rec = await recommendationService.getRecommendations(req.params.sessionId, req.user!.userId);
    sendSuccess(res, rec);
  } catch (err) { next(err); }
};

export const submitRoleFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roleTitle, roleCategory, roleLevel, signal, matchScore } = req.body;
    const result = await recommendationService.submitRoleFeedback(
      req.user!.userId, req.params.sessionId, roleTitle, roleCategory, roleLevel, signal, matchScore
    );
    sendSuccess(res, result, 'Feedback recorded');
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════════════════════
export const getNewsFeed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, category = 'all' } = req.query as any;
    const result = await newsService.getNewsFeed(req.user?.userId, category, Number(page), Number(limit));
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const submitNewsFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { articleId, action } = req.body;
    const result = await newsService.recordNewsFeedback(req.user!.userId, articleId, action);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const getTrendingNews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const articles = await newsService.getTrendingArticles(10);
    sendSuccess(res, articles);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════
export const healthCheck = async (req: AuthRequest, res: Response) => {
  const { getConnectionStatus } = await import('../config/database');
  const { redisClient } = await import('../config/redis');

  let redisStatus = 'disconnected';
  try {
    await redisClient.ping();
    redisStatus = 'connected';
  } catch { /* silent */ }

  const dbStatus = getConnectionStatus();
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };

  const allOk = dbStatus.isConnected === true && status.services.redis === 'connected';
  res.status(allOk ? 200 : 503).json({ success: true, data: status });
};
