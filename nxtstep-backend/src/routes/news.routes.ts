import { Router } from 'express';
import { z } from 'zod';
import * as newsController from '../controllers/newsController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const feedbackSchema = z.object({
  articleId: z.string().min(1),
  action: z.enum(['click', 'save', 'share', 'dismiss']),
});

// News is semi-public: auth is optional for personalization
router.get('/', (req, res, next) => {
  // Try to authenticate but don't fail if no token
  const authHeader = req.headers.authorization;
  if (authHeader) return authenticate(req as never, res, next);
  next();
}, newsController.getNews);

router.get('/trending', newsController.getTrending);

router.post('/feedback', authenticate, validate(feedbackSchema), newsController.recordFeedback);

export default router;