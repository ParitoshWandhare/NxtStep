import { Request, Response } from 'express';
import * as newsService from '../services/newsService';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';

export const getNews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, limit = '20', cursor, personalize = 'true' } = req.query as Record<string, string>;

    const result = await newsService.getPersonalizedNews({
      userId: req.user?.userId,
      category,
      limit: Math.min(parseInt(limit) || 20, 50),
      cursor,
      personalize: personalize !== 'false',
    });

    sendSuccess(res, result.articles, 'News fetched', 200, {
      nextCursor: result.nextCursor,
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    sendError(res, error.message || 'Failed to fetch news');
  }
};

export const getTrending = async (_req: Request, res: Response): Promise<void> => {
  try {
    const articles = await newsService.getTrending(10);
    sendSuccess(res, articles, 'Trending news');
  } catch (err: unknown) {
    const error = err as { message?: string };
    sendError(res, error.message || 'Failed to fetch trending news');
  }
};

export const recordFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      sendSuccess(res, null, 'Feedback noted (unauthenticated)');
      return;
    }
    await newsService.recordFeedback({
      userId: req.user.userId,
      articleId: req.body.articleId,
      action: req.body.action,
    });
    sendSuccess(res, null, 'Feedback recorded');
  } catch (err: unknown) {
    const error = err as { message?: string };
    sendError(res, error.message || 'Failed to record feedback');
  }
};