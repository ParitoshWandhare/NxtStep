// ============================================================
// NxtStep Interview Engine — Interview Routes
// Mount at: /api/interview
// ============================================================

import { Router } from 'express';
import {
  startInterview,
  handleAnswer,
  getStatus,
  getSession,
  handleTerminate,
} from '../controllers/interviewController';

const router = Router();

// POST   /api/interview/start                — start new session
router.post('/start', startInterview);

// POST   /api/interview/:sessionId/answer    — submit an answer
router.post('/:sessionId/answer', handleAnswer);

// GET    /api/interview/:sessionId/status    — get session progress
router.get('/:sessionId/status', getStatus);

// GET    /api/interview/:sessionId/session   — get full session data
router.get('/:sessionId/session', getSession);

// POST   /api/interview/:sessionId/terminate — end session early
router.post('/:sessionId/terminate', handleTerminate);

export default router;
