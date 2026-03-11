import { Router } from 'express';
import * as recommendController from '../controllers/recommendController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/:sessionId', recommendController.getRecommendations);
router.post('/custom', recommendController.getCustomRecommendations);

export default router;