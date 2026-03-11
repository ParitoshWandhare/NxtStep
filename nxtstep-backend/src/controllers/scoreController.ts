import { Response } from 'express';
import * as scoringService from '../services/scoringService';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';

export const getScorecard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scorecard = await scoringService.getScorecard(req.params.sessionId, req.user!.userId);
    sendSuccess(res, scorecard);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get scorecard', error.statusCode || 500);
  }
};

export const getUserScorecards = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scorecards = await scoringService.getUserScorecards(req.user!.userId);
    sendSuccess(res, scorecards);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get scorecards', error.statusCode || 500);
  }
};