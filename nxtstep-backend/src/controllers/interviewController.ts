// ============================================================
// NxtStep — Interview Controller
// ============================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as interviewService from '../services/interviewService';
import { sendSuccess, sendCreated } from '../utils/apiResponse';

export const startInterview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, difficulty, topics, customJobDescription } = req.body;
    const result = await interviewService.startInterview(
      req.user!.userId, role, difficulty, topics, customJobDescription
    );
    sendCreated(res, result, 'Interview session started');
  } catch (err) { next(err); }
};

export const getUserSessions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await interviewService.getUserSessions(req.user!.userId, page, limit);
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const getSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await interviewService.getSession(req.params.sessionId, req.user!.userId);
    sendSuccess(res, session);
  } catch (err) { next(err); }
};

export const getSessionStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = await interviewService.getSessionStatus(req.params.sessionId, req.user!.userId);
    sendSuccess(res, status);
  } catch (err) { next(err); }
};

export const submitAnswer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { questionId, answerText, answerAudioUrl, durationMs } = req.body;
    const result = await interviewService.submitAnswer(
      req.params.sessionId, req.user!.userId, questionId, answerText, answerAudioUrl, durationMs
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
};

export const recordProctoringEvent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { eventType, timestamp, details } = req.body;
    const result = await interviewService.recordProctoringEvent(
      req.params.sessionId, req.user!.userId, eventType, timestamp, details
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
};