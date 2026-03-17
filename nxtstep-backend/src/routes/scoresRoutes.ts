// ============================================================
// NxtStep — Scores Routes
// ============================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getScorecard, getUserScorecards } from '../controllers/scoresController';

const router = Router();

router.use(authenticate);

router.get('/',            getUserScorecards);
router.get('/:sessionId',  getScorecard);

export default router;