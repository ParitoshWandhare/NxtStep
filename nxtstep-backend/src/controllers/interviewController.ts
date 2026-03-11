import { Response } from 'express';
import * as interviewService from '../services/interviewService';
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';

export const startInterview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, difficulty, preferences } = req.body;
    const result = await interviewService.startInterview({
      userId: req.user!.userId,
      role,
      difficulty,
      preferences,
    });
    sendCreated(res, result, 'Interview started. First question is being generated.');
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to start interview', error.statusCode || 500);
  }
};

export const getSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await interviewService.getSession(req.params.sessionId, req.user!.userId);
    sendSuccess(res, session);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get session', error.statusCode || 500);
  }
};

export const handleEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await interviewService.handleEvent({
      sessionId: req.params.sessionId,
      userId: req.user!.userId,
      type: req.body.type,
      payload: req.body.payload || {},
    });
    sendSuccess(res, result);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Event failed', error.statusCode || 500);
  }
};

export const nextQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await interviewService.triggerNextQuestion(
      req.params.sessionId,
      req.user!.userId
    );
    sendSuccess(res, result, 'Next question is being generated');
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to trigger next question', error.statusCode || 500);
  }
};

export const endInterview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await interviewService.endInterview(req.params.sessionId, req.user!.userId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to end interview', error.statusCode || 500);
  }
};

export const getUserSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await interviewService.getUserSessions(req.user!.userId);
    sendSuccess(res, sessions);
  } catch (err: unknown) {
    const error = err as { message?: string; statusCode?: number };
    sendError(res, error.message || 'Failed to get sessions', error.statusCode || 500);
  }
};