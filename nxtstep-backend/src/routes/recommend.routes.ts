// ============================================================
// NxtStep — Recommendation Routes
// Mount at: /api/recommend
// All routes require authentication.
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import * as recommendController from '../controllers/recommendController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// All recommendation routes are protected
router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────

const customRecommendSchema = z.object({
  scorecard: z.object({
    technical:      z.number().min(0).max(10).optional(),
    problemSolving: z.number().min(0).max(10).optional(),
    communication:  z.number().min(0).max(10).optional(),
    confidence:     z.number().min(0).max(10).optional(),
    conceptDepth:   z.number().min(0).max(10).optional(),
  }),
  resumeText:  z.string().max(15000).optional(),
  preferences: z.array(z.string()).max(10).optional(),
  level:       z.enum(['junior', 'mid', 'senior']).optional(),
});

const feedbackSchema = z.object({
  roleTitle: z.string().min(1).max(150),
  signal:    z.enum(['relevant', 'not_relevant', 'applied', 'saved']),
});

// ─── Routes ──────────────────────────────────────────────────

// GET  /api/recommend/:sessionId         — fetch session recommendations
router.get('/:sessionId', recommendController.getRecommendations);

// POST /api/recommend/custom             — ad-hoc / test recommendations
router.post('/custom', validate(customRecommendSchema), recommendController.getCustomRecommendations);

// POST /api/recommend/:sessionId/feedback — record role feedback signal
router.post('/:sessionId/feedback', validate(feedbackSchema), recommendController.recordFeedback);

// GET  /api/recommend/:sessionId/stats   — feedback aggregation (admin)
router.get('/:sessionId/stats', recommendController.getFeedbackStats);

export default router;