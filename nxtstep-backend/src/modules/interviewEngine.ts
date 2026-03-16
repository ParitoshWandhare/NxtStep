// ============================================================
// NxtStep — Interview Engine Module
// Self-contained: types, state machine, question generation,
// session orchestration. Replaces scattered interviewService logic.
// ============================================================

import mongoose from 'mongoose';
import { InterviewSession } from '../models/InterviewSession';
import { aiAdapter } from '../ai/aiAdapter';
import { buildQuestionGenerationPrompt, buildFollowUpPrompt } from '../ai/prompts';
import { addGenerateQuestionJob, addEvaluateAnswerJob, addGenerateScorecardJob } from '../queues';
import { signEphemeralToken } from '../utils/jwt';
import { safeRedisSet, safeRedisGet, safeRedisDel } from '../config/redis';
import { emitQuestionReady, emitSessionTerminated } from '../sockets/index';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { env } from '../config/env';

// ── Engine State Machine ─────────────────────────────────────
export type EngineState =
  | 'INIT'
  | 'PREP'
  | 'GENERATE_Q'
  | 'AWAIT_ANSWER'
  | 'PROCESS_ANSWER'
  | 'EVALUATE'
  | 'DECIDE_FOLLOWUP'
  | 'GENERATE_FU'
  | 'AWAIT_FU_ANSWER'
  | 'LOOP'
  | 'TERMINATE'
  | 'AGGREGATE'
  | 'COMPLETE';

export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'terminated';
export type Difficulty = 'junior' | 'mid' | 'senior';

export interface GeneratedQuestion {
  id: string;
  text: string;
  type: 'technical' | 'behavioral' | 'concept' | 'problem' | 'follow_up';
  topic: string;
  difficulty: Difficulty;
  expectedKeywords: string[];
  followUpCount: number;
  parentQuestionId?: string;
}

export interface SessionStartParams {
  userId: string;
  role: string;
  difficulty: Difficulty;
  topics?: string[];
  customJobDescription?: string;
}

const SESSION_CACHE_TTL = 300;

// ── Start a new interview session ────────────────────────────
export const startSession = async (params: SessionStartParams) => {
  const { userId, role, difficulty, topics, customJobDescription } = params;

  const session = await InterviewSession.create({
    userId: new mongoose.Types.ObjectId(userId),
    role,
    difficulty,
    customTopics: topics ?? [],
    customJobDescription,
    engineState: 'INIT' as EngineState,
    status: 'in_progress' as SessionStatus,
    questions: [],
    answers: [],
    proctoringData: { tabSwitches: 0, faceWarnings: 0, isTerminated: false, events: [] },
  });

  // Transition INIT → GENERATE_Q: enqueue first question
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

  await InterviewSession.updateOne({ _id: session._id }, { $set: { engineState: 'GENERATE_Q' } });

  const sessionToken = signEphemeralToken({ userId, sessionId: session._id.toString() });

  logger.info({ sessionId: session._id, userId, role, difficulty }, 'Interview session started');
  return { sessionId: session._id.toString(), sessionToken, engineState: 'GENERATE_Q' };
};

// ── Generate and inject the next question ────────────────────
export const generateNextQuestion = async (
  sessionId: string,
  userId: string,
  role: string,
  topic: string,
  difficulty: Difficulty,
  questionIndex: number,
  askedTopics: string[],
  askedQuestionIds: string[]
): Promise<GeneratedQuestion> => {
  const prompt = buildQuestionGenerationPrompt({
    role,
    topic,
    difficulty,
    questionIndex,
    askedTopics,
    askedQuestionIds,
  });

  const raw = await aiAdapter.sendJSON<{
    text: string;
    type: string;
    expectedKeywords: string[];
  }>(prompt, { temperature: 0.65, maxTokens: 600 });

  const question: GeneratedQuestion = {
    id: `q-${questionIndex}-${Date.now()}`,
    text: raw.text,
    type: (raw.type as any) ?? 'technical',
    topic,
    difficulty,
    expectedKeywords: raw.expectedKeywords ?? [],
    followUpCount: 0,
  };

  await InterviewSession.updateOne(
    { _id: sessionId },
    {
      $push: { questions: question },
      $set: { engineState: 'AWAIT_ANSWER' as EngineState },
    }
  );

  await safeRedisDel(`session:${sessionId}`);

  // Notify frontend via Socket.IO
  emitQuestionReady(sessionId, question);

  logger.info({ sessionId, questionId: question.id, topic, questionIndex }, 'Question generated');
  return question;
};

// ── Generate a follow-up question ────────────────────────────
export const generateFollowUp = async (
  sessionId: string,
  parentQuestionId: string,
  parentQuestionText: string,
  candidateAnswer: string,
  missingKeywords: string[],
  weaknesses: string[],
  topic: string,
  difficulty: Difficulty
): Promise<GeneratedQuestion | null> => {
  const session = await InterviewSession.findById(sessionId, { questions: 1 }).lean();
  if (!session) return null;

  const parent = session.questions.find((q: any) => q.id === parentQuestionId);
  if (!parent || (parent as any).followUpCount >= env.INTERVIEW_MAX_FOLLOWUPS_PER_QUESTION) {
    return null;
  }

  const prompt = buildFollowUpPrompt({
    originalQuestion: parentQuestionText,
    candidateAnswer,
    missingKeywords,
    weaknesses,
  });

  const raw = await aiAdapter.sendJSON<{ text: string; targetKeywords: string[] }>(prompt, {
    temperature: 0.5,
    maxTokens: 400,
  });

  const followUp: GeneratedQuestion = {
    id: `fu-${parentQuestionId}-${(parent as any).followUpCount + 1}`,
    text: raw.text,
    type: 'follow_up',
    topic,
    difficulty,
    expectedKeywords: raw.targetKeywords ?? [],
    followUpCount: 0,
    parentQuestionId,
  };

  await InterviewSession.updateOne(
    { _id: sessionId, 'questions.id': parentQuestionId },
    {
      $push: { questions: followUp },
      $inc: { 'questions.$.followUpCount': 1 },
      $set: { engineState: 'AWAIT_FU_ANSWER' as EngineState },
    }
  );

  await safeRedisDel(`session:${sessionId}`);
  emitQuestionReady(sessionId, followUp);

  logger.info({ sessionId, parentQuestionId, followUpId: followUp.id }, 'Follow-up generated');
  return followUp;
};

// ── Process an answer submission ─────────────────────────────
export const processAnswer = async (
  sessionId: string,
  userId: string,
  questionId: string,
  answerText: string,
  answerAudioUrl?: string,
  durationMs?: number
) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId, status: 'in_progress' });
  if (!session) throw createError('Active session not found', 404, 'SESSION_NOT_FOUND');

  const question = session.questions.find((q: any) => q.id === questionId);
  if (!question) throw createError('Question not found in session', 404, 'QUESTION_NOT_FOUND');

  const alreadyAnswered = session.answers.find((a: any) => a.questionId === questionId);
  if (alreadyAnswered) throw createError('Question already answered', 409, 'ALREADY_ANSWERED');

  session.answers.push({
    questionId,
    answerText,
    answerAudioUrl,
    startedAt: new Date(Date.now() - (durationMs ?? 0)),
    submittedAt: new Date(),
  } as any);

  session.engineState = 'PROCESS_ANSWER';
  await session.save();
  await safeRedisDel(`session:${sessionId}`);

  // Enqueue evaluation
  await addEvaluateAnswerJob({
    sessionId,
    questionId,
    userId,
    questionText: (question as any).text,
    answerText,
    topic: (question as any).topic,
    difficulty: session.difficulty as Difficulty,
    questionIndex: session.answers.length - 1,
    totalQuestions: env.INTERVIEW_MAX_QUESTIONS,
    role: session.role,
  });

  logger.info({ sessionId, questionId }, 'Answer submitted, evaluation enqueued');
  return { status: 'processing' };
};

// ── Terminate session (proctoring or user exit) ───────────────
export const terminateSession = async (
  sessionId: string,
  userId: string,
  reason: string
) => {
  const updated = await InterviewSession.findOneAndUpdate(
    { _id: sessionId, userId, status: 'in_progress' },
    {
      $set: {
        status: 'terminated',
        engineState: 'TERMINATE',
        terminationReason: reason,
        'proctoringData.isTerminated': true,
      },
    },
    { new: true }
  );

  if (!updated) return null;

  await safeRedisDel(`session:${sessionId}`);
  emitSessionTerminated(sessionId, reason);

  logger.warn({ sessionId, userId, reason }, 'Session terminated');
  return updated;
};

// ── Complete session — transition to AGGREGATE ────────────────
export const completeSession = async (sessionId: string, userId: string) => {
  await InterviewSession.updateOne(
    { _id: sessionId, userId },
    {
      $set: {
        status: 'completed',
        engineState: 'AGGREGATE',
        completedAt: new Date(),
      },
    }
  );

  await safeRedisDel(`session:${sessionId}`);

  // Enqueue scorecard generation
  await addGenerateScorecardJob({ sessionId, userId });

  logger.info({ sessionId, userId }, 'Session completed, scorecard enqueued');
};

// ── Get session with cache ────────────────────────────────────
export const getSession = async (sessionId: string, userId: string) => {
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

// ── Get session status (polling) ──────────────────────────────
export const getSessionStatus = async (sessionId: string, userId: string) => {
  const session = await InterviewSession.findOne(
    { _id: sessionId, userId },
    { status: 1, engineState: 1, questions: 1, answers: 1, 'proctoringData.isTerminated': 1 }
  ).lean();

  if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND');

  return {
    status: session.status,
    engineState: session.engineState,
    questionsGenerated: session.questions?.length ?? 0,
    answersSubmitted: session.answers?.length ?? 0,
    isTerminated: session.proctoringData?.isTerminated ?? false,
  };
};

// ── Record proctoring event ───────────────────────────────────
export const recordProctoringEvent = async (
  sessionId: string,
  userId: string,
  eventType: string,
  timestamp: number,
  details?: Record<string, unknown>
) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId, status: 'in_progress' });
  if (!session) throw createError('Active session not found', 404, 'SESSION_NOT_FOUND');

  session.proctoringData.events.push({ type: eventType as any, timestamp: new Date(timestamp), details });

  if (eventType === 'tab_switch') {
    session.proctoringData.tabSwitches += 1;
    if (session.proctoringData.tabSwitches >= env.PROCTORING_MAX_TAB_SWITCHES) {
      await terminateSession(sessionId, userId, 'Exceeded maximum tab switches');
      return { terminated: true };
    }
  }

  if (eventType === 'face_missing') session.proctoringData.faceWarnings += 1;

  if (eventType === 'termination') {
    await terminateSession(sessionId, userId, (details?.reason as string) ?? 'Proctoring violation');
    return { terminated: true };
  }

  await session.save();
  await safeRedisDel(`session:${sessionId}`);
  return { terminated: false };
};

// ── List user sessions ────────────────────────────────────────
export const listUserSessions = async (userId: string, page = 1, limit = 10) => {
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
