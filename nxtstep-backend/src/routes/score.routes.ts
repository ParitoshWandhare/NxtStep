import { Router } from 'express';
import * as scoreController from '../controllers/scoreController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', scoreController.getUserScorecards);
router.get('/:sessionId', scoreController.getScorecard);

export default router;