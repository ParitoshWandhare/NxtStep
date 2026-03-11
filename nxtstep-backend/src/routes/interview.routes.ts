import { Router } from 'express';
import { z } from 'zod';
import * as interviewController from '../controllers/interviewController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { interviewLimiter } from '../middleware/rateLimiter';

const router = Router();

const startSchema = z.object({
  role: z.string().min(2).max(100),
  difficulty: z.enum(['junior', 'mid', 'senior']).default('mid'),
  preferences: z.array(z.string()).optional(),
});

const eventSchema = z.object({
  type: z.enum(['answer', 'tab_switch', 'camera_event']),
  payload: z.record(z.unknown()).default({}),
});

router.use(authenticate);

router.get('/', interviewController.getUserSessions);
router.post('/start', validate(startSchema), interviewController.startInterview);
router.get('/:sessionId', interviewController.getSession);
router.post('/:sessionId/event', interviewLimiter, validate(eventSchema), interviewController.handleEvent);
router.post('/:sessionId/next', interviewController.nextQuestion);
router.post('/:sessionId/end', interviewController.endInterview);

export default router;