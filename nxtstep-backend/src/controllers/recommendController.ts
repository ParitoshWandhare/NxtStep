import { Response } from 'express';
import * as recommendationService from '../services/recommendationService';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';

export const getRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const recommendations = await recommendationService.getRecommendations(
      req.params.sessionId,
      req.user!.userId
    );
    sendSuccess(res, recommendations);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get recommendations', error.statusCode || 500);
  }
};

export const getCustomRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // For testing: allow passing scorecard + resume directly
    const { sessionId } = req.body;
    const recommendations = await recommendationService.getRecommendations(
      sessionId,
      req.user!.userId
    );
    sendSuccess(res, recommendations);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get recommendations', error.statusCode || 500);
  }
};