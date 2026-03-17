// ============================================================
// NxtStep — Recommendations Routes
// ============================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate, recommendFeedbackSchema } from '../middleware/validate';
import { getRecommendations, submitRoleFeedback } from '../controllers/recommendationsController';

const router = Router();

router.use(authenticate);

router.get('/:sessionId',          getRecommendations);
router.post('/:sessionId/feedback', validate(recommendFeedbackSchema), submitRoleFeedback);

export default router;