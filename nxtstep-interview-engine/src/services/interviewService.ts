// ============================================================
// NxtStep Interview Engine — Interview Service
// High-level orchestration: start, submit answer, get status.
// This is the public API surface consumed by controllers.
// ============================================================

import crypto from 'crypto';
import { createStateMachine } from './stateMachine';
import { sessionStore, buildSessionContext } from './sessionStore';
import {
  enqueueEvaluateAnswer,
  enqueueGenerateQuestion,
} from '../queues/index';
import {
  DifficultyLevel,
  InterviewSession,
  SessionConfig,
} from '../types/interview.types';

// ─── Start a new interview session ───────────────────────────

export async function startSession(params: {
  userId:       string;
  role:         string;
  level:        DifficultyLevel;
  resumeText?:  string;
  preferences?: string[];
  config?:      Partial<SessionConfig>;
}): Promise<InterviewSession> {
  const { userId, role, level, resumeText, preferences, config } = params;
  const sessionId = `sess_${crypto.randomBytes(8).toString('hex')}`;

  const context = buildSessionContext({ sessionId, userId, role, level, resumeText, preferences });
  const session = await sessionStore.create(context, config);

  // Advance through INIT → PREP → GENERATE_Q
  const sm = createStateMachine(sessionId, 'INIT');
  sm.transition('PREP');
  sm.transition('GENERATE_Q');

  session.state = sm.state;
  await sessionStore.save(session);

  // Kick off first question generation asynchronously
  await enqueueGenerateQuestion({
    sessionId,
    role,
    level,
    previousQuestions: [],
  });

  console.log(`[InterviewService] Session ${sessionId} started for user ${userId} | role: ${role} | level: ${level}`);
  return session;
}

// ─── Submit an answer ────────────────────────────────────────

export async function submitAnswer(params: {
  sessionId:  string;
  questionId: string;
  answerText: string;
}): Promise<{ jobId: string; message: string }> {
  const { sessionId, questionId, answerText } = params;

  const session = await sessionStore.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const sm = createStateMachine(sessionId, session.state);
  if (!sm.isAwaiting()) {
    throw new Error(`Session ${sessionId} is not awaiting an answer (state: ${session.state})`);
  }

  const question = session.questions.find(q => q.id === questionId);
  if (!question) throw new Error(`Question ${questionId} not found in session`);

  // Transition: AWAIT_ANSWER → PROCESS_ANSWER → EVALUATE
  sm.transition('PROCESS_ANSWER');
  sm.transition('EVALUATE');
  session.state = sm.state;
  await sessionStore.save(session);

  // Enqueue async evaluation
  const jobId = await enqueueEvaluateAnswer({
    sessionId,
    questionId,
    answerText,
    questionText:     question.text,
    expectedKeywords: question.expectedKeywords,
    questionType:     question.type,
  });

  return { jobId, message: 'Answer received and queued for evaluation' };
}

// ─── Get session status ───────────────────────────────────────

export async function getSessionStatus(sessionId: string): Promise<{
  state:          string;
  questionsAsked: number;
  followUpsUsed:  number;
  progress:       number;
} | null> {
  const session = await sessionStore.get(sessionId);
  if (!session) return null;

  const primaryQuestions = session.questions.filter(q => !q.isFollowUp).length;
  const progress = Math.round((primaryQuestions / session.config.maxQuestions) * 100);

  return {
    state:          session.state,
    questionsAsked: primaryQuestions,
    followUpsUsed:  session.totalFollowUps,
    progress,
  };
}

// ─── End session early ────────────────────────────────────────

export async function terminateSession(sessionId: string): Promise<void> {
  const session = await sessionStore.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.state       = 'TERMINATE';
  session.completedAt = new Date();
  await sessionStore.save(session);

  // Trigger scorecard computation
  await (await import('../queues/index')).enqueueComputeScorecard({
    sessionId,
    userId: session.context.userId,
  });

  console.log(`[InterviewService] Session ${sessionId} terminated early`);
}
