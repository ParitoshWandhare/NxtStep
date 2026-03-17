// ============================================================
// NxtStep — Scores Controller
// ============================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as scoringService from '../services/scoringService';
import { sendSuccess } from '../utils/apiResponse';

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