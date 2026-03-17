// ============================================================
// NxtStep — News Controller
// ============================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as newsService from '../services/newsService';
import { sendSuccess } from '../utils/apiResponse';

export const getNewsFeed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, category = 'all' } = req.query as any;
    const result = await newsService.getNewsFeed(req.user?.userId, category, Number(page), Number(limit));
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const getTrendingNews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const articles = await newsService.getTrendingArticles(10);
    sendSuccess(res, articles);
  } catch (err) { next(err); }
};

export const submitNewsFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { articleId, action } = req.body;
    const result = await newsService.recordNewsFeedback(req.user!.userId, articleId, action);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};