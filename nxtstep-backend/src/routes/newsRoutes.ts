// ============================================================
// NxtStep — News Routes
// ============================================================

import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { validate, newsFeedbackSchema, newsQuerySchema } from '../middleware/validate';
import { getNewsFeed, getTrendingNews, submitNewsFeedback } from '../controllers/newsController';

const router = Router();

router.get('/',          optionalAuthenticate, validate(newsQuerySchema, 'query'), getNewsFeed);
router.get('/trending',  getTrendingNews);
router.post('/feedback', authenticate, validate(newsFeedbackSchema), submitNewsFeedback);

export default router;