// ============================================================
// NxtStep Interview Engine — Interview Controller
// Thin HTTP handlers: validate → call service → respond.
// ============================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { startSession, submitAnswer, getSessionStatus, terminateSession } from '../services/interviewService';
import { sessionStore } from '../services/sessionStore';

// ─── Zod schemas ──────────────────────────────────────────────

const StartSchema = z.object({
  userId:      z.string().min(1),
  role:        z.string().min(1),
  level:       z.enum(['junior', 'mid', 'senior']),
  resumeText:  z.string().optional(),
  preferences: z.array(z.string()).optional(),
  config: z.object({
    maxQuestions:            z.number().int().min(3).max(20).optional(),
    maxFollowUpsPerQuestion: z.number().int().min(0).max(5).optional(),
  }).optional(),
});

const SubmitAnswerSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().min(0).max(10000),
});

// ─── Helpers ──────────────────────────────────────────────────

function sendSuccess(res: Response, data: unknown, statusCode = 200) {
  res.status(statusCode).json({ success: true, data });
}

function sendError(res: Response, message: string, statusCode = 400) {
  res.status(statusCode).json({ success: false, error: message });
}

// ─── Controllers ──────────────────────────────────────────────

/**
 * POST /api/interview/start
 * Starts a new interview session for a user.
 */
export async function startInterview(req: Request, res: Response): Promise<void> {
  const parsed = StartSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.message);
    return;
  }

  try {
    const session = await startSession(parsed.data);
    sendSuccess(res, {
      sessionId:   session.sessionId,
      state:       session.state,
      config:      session.config,
      startedAt:   session.startedAt,
      message:     'Interview started. First question is being generated.',
    }, 201);
  } catch (err) {
    console.error('[Controller:startInterview]', err);
    sendError(res, (err as Error).message, 500);
  }
}

/**
 * POST /api/interview/:sessionId/answer
 * Submits a candidate's answer to the current question.
 */
export async function handleAnswer(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const parsed = SubmitAnswerSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.message);
    return;
  }

  try {
    const result = await submitAnswer({
      sessionId,
      questionId: parsed.data.questionId,
      answerText: parsed.data.answerText,
    });

    sendSuccess(res, result);
  } catch (err) {
    console.error('[Controller:handleAnswer]', err);
    const msg = (err as Error).message;
    const code = msg.includes('not found') ? 404 : msg.includes('not awaiting') ? 409 : 500;
    sendError(res, msg, code);
  }
}

/**
 * GET /api/interview/:sessionId/status
 * Returns the current state and progress of a session.
 */
export async function getStatus(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const status = await getSessionStatus(sessionId);
    if (!status) {
      sendError(res, `Session ${sessionId} not found`, 404);
      return;
    }
    sendSuccess(res, status);
  } catch (err) {
    sendError(res, (err as Error).message, 500);
  }
}

/**
 * GET /api/interview/:sessionId/session
 * Returns the full session (questions, evaluations) — for debugging / review.
 */
export async function getSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const session = await sessionStore.get(sessionId);
    if (!session) {
      sendError(res, `Session ${sessionId} not found`, 404);
      return;
    }
    sendSuccess(res, session);
  } catch (err) {
    sendError(res, (err as Error).message, 500);
  }
}

/**
 * POST /api/interview/:sessionId/terminate
 * Ends the interview early and triggers scorecard computation.
 */
export async function handleTerminate(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    await terminateSession(sessionId);
    sendSuccess(res, { message: 'Session terminated. Scorecard is being computed.' });
  } catch (err) {
    const msg = (err as Error).message;
    sendError(res, msg, msg.includes('not found') ? 404 : 500);
  }
}
