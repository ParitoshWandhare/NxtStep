// ============================================================
// NxtStep — Interview Routes
// ============================================================

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate, startInterviewSchema, submitAnswerSchema, proctoringEventSchema } from '../middleware/validate';
import { interviewLimiter } from '../middleware/rateLimiter';
import {
  startInterview,
  getUserSessions,
  getSession,
  getSessionStatus,
  submitAnswer,
  recordProctoringEvent,
} from '../controllers/interviewController';

const router = Router();

router.use(authenticate);

router.post('/',                          interviewLimiter, validate(startInterviewSchema), startInterview);
router.get('/',                           getUserSessions);
router.get('/:sessionId',                 getSession);
router.get('/:sessionId/status',          getSessionStatus);
router.post('/:sessionId/answer',         validate(submitAnswerSchema),    submitAnswer);
router.post('/:sessionId/proctoring',     validate(proctoringEventSchema), recordProctoringEvent);

export default router;