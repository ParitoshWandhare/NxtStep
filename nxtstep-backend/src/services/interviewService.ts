// ============================================================
// NxtStep — Interview Service
// ============================================================

import mongoose from 'mongoose';
import { InterviewSession } from '../models/InterviewSession';
import { addGenerateQuestionJob, addEvaluateAnswerJob } from '../queues';
import { signEphemeralToken } from '../utils/jwt';
import { safeRedisSet, safeRedisGet, safeRedisDel } from '../config/redis';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { env } from '../config/env';

const SESSION_CACHE_TTL = 300; // 5 min

// ── Start Interview ──────────────────────────────────────────
export const startInterview = async (
  userId: string,
  role: string,
  difficulty: 'junior' | 'mid' | 'senior' = 'mid',
  topics?: string[],
  customJobDescription?: string
) => {
  const session = await InterviewSession.create({
    userId: new mongoose.Types.ObjectId(userId),
    role,
    difficulty,
    status: 'in_progress',
    questions: [],
    answers: [],
    proctoring: { tabSwitchCount: 0, cameraEvents: [], terminated: false },
  } as any);

  // Enqueue first question generation
  await addGenerateQuestionJob({
    sessionId: session._id.toString(),
    userId,
    role,
    topic: topics?.[0] ?? role,
    difficulty,
    questionIndex: 0,
    askedTopics: [],
    askedQuestionIds: [],
  });

  // Ephemeral token scoped to this session (2h)
  const sessionToken = signEphemeralToken({
    userId,
    sessionId: session._id.toString(),
    type: 'interview_session',
  });

  logger.info({ sessionId: session._id, userId, role }, 'Interview session started');
  return { sessionId: session._id.toString(), sessionToken, status: 'initializing' };
};

// ── Get Session ──────────────────────────────────────────────
export const getSession = async (sessionId: string, userId: string) => {
  // Try cache
  const cached = await safeRedisGet(`session:${sessionId}`);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.userId?.toString() === userId) return parsed;
  }

  const session = await InterviewSession.findOne({ _id: sessionId, userId }).lean();
  if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND');

  await safeRedisSet(`session:${sessionId}`, JSON.stringify(session), SESSION_CACHE_TTL);
  return session;
};

// ── Submit Answer ────────────────────────────────────────────
export const submitAnswer = async (
  sessionId: string,
  userId: string,
  questionId: string,
  answerText: string,
  answerAudioUrl?: string,
  durationMs?: number
) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId, status: 'in_progress' });
  if (!session) throw createError('Active session not found', 404, 'SESSION_NOT_FOUND');

  const question = session.questions.find((q) => q.id === questionId);
  if (!question) throw createError('Question not found in session', 404, 'QUESTION_NOT_FOUND');

  const alreadyAnswered = session.answers.find((a) => a.questionId === questionId);
  if (alreadyAnswered) throw createError('Question already answered', 409, 'ALREADY_ANSWERED');

  const now = new Date();
  const start = durationMs ? new Date(now.getTime() - durationMs) : now;

  session.answers.push({
    questionId,
    answerText,
    answerAudioUrl,
    timestamps: { start, end: now },
  } as any);

  await session.save();

  // Invalidate cache
  await safeRedisDel(`session:${sessionId}`);

  // Enqueue evaluation
  await addEvaluateAnswerJob({
    sessionId,
    questionId,
    userId,
    questionText: question.text,
    answerText,
    topic: (question as any).topic ?? session.role,
    difficulty: session.difficulty as 'junior' | 'mid' | 'senior',
    questionIndex: session.answers.length - 1,
    totalQuestions: env.MAX_QUESTIONS_PER_SESSION,
    role: session.role,
  });

  logger.info({ sessionId, questionId, userId }, 'Answer submitted');
  return { status: 'processing', message: 'Answer submitted and queued for evaluation' };
};

// ── Record Proctoring Event ──────────────────────────────────
export const recordProctoringEvent = async (
  sessionId: string,
  userId: string,
  eventType: string,
  timestamp: number,
  details?: Record<string, unknown>
) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId, status: 'in_progress' });
  if (!session) throw createError('Active session not found', 404, 'SESSION_NOT_FOUND');

  const proctoring = session.proctoring as any;

  if (eventType === 'tab_switch') {
    proctoring.tabSwitchCount = (proctoring.tabSwitchCount ?? 0) + 1;
    if (proctoring.tabSwitchCount >= env.TAB_SWITCH_TERMINATE_THRESHOLD) {
      proctoring.terminated = true;
      proctoring.terminationReason = 'Exceeded maximum tab switches';
      session.status = 'terminated';
    }
  }

  if (eventType === 'face_missing') {
    proctoring.cameraEvents = proctoring.cameraEvents ?? [];
    proctoring.cameraEvents.push({
      timestamp: new Date(timestamp),
      eventType: 'face_absent',
      details: details ? String(details.reason ?? '') : undefined,
    });
  }

  if (eventType === 'termination') {
    proctoring.terminated = true;
    proctoring.terminationReason = (details?.reason as string) ?? 'Proctoring violation';
    session.status = 'terminated';
  }

  await session.save();
  await safeRedisDel(`session:${sessionId}`);

  if (session.status === 'terminated') {
    logger.warn({ sessionId, userId, eventType }, 'Session terminated by proctoring');
  }

  return { terminated: session.status === 'terminated' };
};

// ── Get Session Status for polling ──────────────────────────
export const getSessionStatus = async (sessionId: string, userId: string) => {
  const session = await InterviewSession.findOne(
    { _id: sessionId, userId },
    { status: 1, questions: 1, answers: 1, proctoring: 1 }
  ).lean();

  if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND');

  return {
    status: session.status,
    questionsGenerated: session.questions?.length ?? 0,
    answersSubmitted: session.answers?.length ?? 0,
    isTerminated: (session.proctoring as any)?.terminated ?? false,
  };
};

// ── List User Sessions ───────────────────────────────────────
export const getUserSessions = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [sessions, total] = await Promise.all([
    InterviewSession.find({ userId }, { questions: 0, answers: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InterviewSession.countDocuments({ userId }),
  ]);
  return { sessions, total, page, pages: Math.ceil(total / limit) };
};