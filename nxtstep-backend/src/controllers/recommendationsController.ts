// ============================================================
// NxtStep — Recommendations Controller
// ============================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as recommendationService from '../services/recommendationService';
import { sendSuccess } from '../utils/apiResponse';

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