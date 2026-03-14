// ============================================================
// NxtStep — Recommend Controller
// Thin HTTP layer: validate → call service → respond.
//
// Routes:
//   GET  /api/recommend/:sessionId        — get session recommendations
//   POST /api/recommend/custom             — ad-hoc recommendations
//   POST /api/recommend/:sessionId/feedback — record role feedback
//   GET  /api/recommend/:sessionId/stats   — feedback stats (admin)
// ============================================================

import { Response } from 'express';
import * as recommendService from '../services/recommendationService';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';
import { FeedbackSignal } from '../models/RoleFeedback';
import { DifficultyLevel } from '../data/roleDatabase';

// ─── GET /api/recommend/:sessionId ───────────────────────────

export const getRecommendations = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const recommendations = await recommendService.getRecommendations(
      req.params.sessionId,
      req.user!.userId,
    );
    sendSuccess(res, recommendations);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get recommendations', error.statusCode || 500);
  }
};

// ─── POST /api/recommend/custom ──────────────────────────────

export const getCustomRecommendations = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      scorecard,
      resumeText,
      preferences,
      level,
    } = req.body as {
      scorecard?:    Record<string, number>;
      resumeText?:   string;
      preferences?:  string[];
      level?:        DifficultyLevel;
    };

    if (!scorecard || typeof scorecard !== 'object') {
      sendError(res, 'scorecard object is required in request body', 400);
      return;
    }

    const recommendations = await recommendService.getCustomRecommendations({
      userId:      req.user!.userId,
      scorecard,
      resumeText:  resumeText  ?? '',
      preferences: preferences ?? [],
      level:       level       ?? 'mid',
    });

    sendCreated(res, { roles: recommendations });
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get recommendations', error.statusCode || 500);
  }
};

// ─── POST /api/recommend/:sessionId/feedback ─────────────────

export const recordFeedback = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const { sessionId } = req.params;
  const { roleTitle, signal } = req.body as {
    roleTitle?: string;
    signal?:    FeedbackSignal;
  };

  if (!roleTitle || !signal) {
    sendError(res, 'roleTitle and signal are required', 400);
    return;
  }

  const validSignals: FeedbackSignal[] = ['relevant', 'not_relevant', 'applied', 'saved'];
  if (!validSignals.includes(signal)) {
    sendError(res, `signal must be one of: ${validSignals.join(', ')}`, 400);
    return;
  }

  try {
    await recommendService.recordRoleFeedback({
      userId:    req.user!.userId,
      sessionId,
      roleTitle,
      signal,
    });
    sendSuccess(res, null, 'Feedback recorded');
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to record feedback', error.statusCode || 500);
  }
};

// ─── GET /api/recommend/:sessionId/stats ─────────────────────

export const getFeedbackStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const stats = await recommendService.getFeedbackStats(req.params.sessionId);
    sendSuccess(res, stats);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get feedback stats', error.statusCode || 500);
  }
};