// ============================================================
// NxtStep — Evaluation Engine Module
// BUG FIX: Evaluation.create() was missing `answerText`.
// The field is required by Mongoose schema but was not being
// forwarded from the function params into the create() call.
// ============================================================

import crypto from 'crypto';
import { aiAdapter, AIMessage } from '../ai/aiAdapter';
import { buildEvaluationPrompt } from '../ai/prompts';
import { Evaluation } from '../models/Evaluation';
import { Scorecard } from '../models/Scorecard';
import { InterviewSession } from '../models/InterviewSession';
import { emitEvaluationComplete, emitScorecardReady } from '../sockets/index';
import { safeRedisDel } from '../config/redis';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { env } from '../config/env';

const WEIGHTS = {
  technical:     env.SCORE_WEIGHT_TECHNICAL,
  problemSolving: env.SCORE_WEIGHT_PROBLEM_SOLVING,
  communication: env.SCORE_WEIGHT_COMMUNICATION,
  confidence:    env.SCORE_WEIGHT_CONFIDENCE,
  conceptDepth:  env.SCORE_WEIGHT_CONCEPT_DEPTH,
};

export interface DimensionScores {
  technical: number;
  communication: number;
  problemSolving: number;
  confidence: number;
  conceptDepth: number;
}

export interface EvaluationResult {
  scores: DimensionScores;
  overall: number;
  detectedKeywords: string[];
  missingKeywords: string[];
  feedback: {
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
  };
  followUp: {
    shouldAsk: boolean;
    reason: string;
    suggestedQuestion?: string;
  };
  promptHash: string;
  latencyMs: number;
}

const hashPrompt = (messages: AIMessage[]): string =>
  crypto.createHash('sha256').update(JSON.stringify(messages)).digest('hex').slice(0, 12);

// ── Evaluate a single answer ──────────────────────────────────
export const evaluateAnswer = async (params: {
  sessionId: string;
  questionId: string;
  userId: string;
  questionText: string;
  answerText: string;
  topic: string;
  difficulty: 'junior' | 'mid' | 'senior';
  questionIndex: number;
  totalQuestions: number;
  role: string;
}): Promise<EvaluationResult> => {
  const {
    sessionId, questionId, userId,
    questionText, answerText,      // ← answerText was passed in but not saved
    topic, difficulty, questionIndex, totalQuestions, role,
  } = params;
  const startTime = Date.now();

  const promptObj = buildEvaluationPrompt({
    question: questionText,
    answer: answerText,
    expectedKeywords: [],
    role,
    level: difficulty,
  });

  const messages: AIMessage[] = [
    { role: 'system', content: promptObj.system },
    { role: 'user', content: promptObj.user },
  ];

  const raw = await aiAdapter.sendJSON<{
    scores: DimensionScores;
    detectedKeywords: string[];
    missingKeywords: string[];
    feedback: { strengths: string[]; weaknesses: string[]; improvements: string[] };
    followUp: { shouldAsk: boolean; reason: string; suggestedQuestion?: string };
  }>(messages, { temperature: 0.2, maxTokens: 1200 });

  const latencyMs = Date.now() - startTime;

  // Weighted overall score
  const overall = parseFloat((
    raw.scores.technical    * WEIGHTS.technical +
    raw.scores.problemSolving * WEIGHTS.problemSolving +
    raw.scores.communication  * WEIGHTS.communication +
    raw.scores.confidence    * WEIGHTS.confidence +
    raw.scores.conceptDepth  * WEIGHTS.conceptDepth
  ).toFixed(2));

  const promptHash = hashPrompt(messages);

  // ── FIX: include `answerText` in the create payload ──────────
  await Evaluation.create({
    sessionId,
    questionId,
    answerText,                             // ← was missing before
    scores: raw.scores,
    detectedKeywords: raw.detectedKeywords ?? [],
    missingKeywords:  raw.missingKeywords  ?? [],
    feedback: raw.feedback ?? { strengths: [], weaknesses: [], improvements: [] },
    followUp: raw.followUp ?? { shouldAsk: false, reason: 'Not required' },
    promptHash,
    modelUsed: env.OPENROUTER_DEFAULT_MODEL,
    evaluationLatencyMs: latencyMs,
  });

  // Notify frontend
  emitEvaluationComplete(sessionId, {
    questionId,
    scores: raw.scores,
    overall,
    feedback: raw.feedback,
  });

  logger.info({ sessionId, questionId, overall, latencyMs }, 'Answer evaluated');

  return {
    scores:          raw.scores,
    overall,
    detectedKeywords: raw.detectedKeywords ?? [],
    missingKeywords:  raw.missingKeywords  ?? [],
    feedback: raw.feedback ?? { strengths: [], weaknesses: [], improvements: [] },
    followUp: raw.followUp ?? { shouldAsk: false, reason: '' },
    promptHash,
    latencyMs,
  };
};

// ── Determine next engine state after evaluation ──────────────
export const decideNextState = async (
  sessionId: string,
  questionId: string,
  evalResult: EvaluationResult
): Promise<'GENERATE_FU' | 'GENERATE_Q' | 'TERMINATE'> => {
  const session = await InterviewSession.findById(sessionId, {
    questions: 1, answers: 1, difficulty: 1, role: 1, userId: 1,
  }).lean();

  if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND');

  const question      = session.questions.find((q: any) => q.id === questionId);
  const followUpCount = (question as any)?.followUpCount ?? 0;
  const answersCount  = session.answers.length;

  const shouldFollowUp =
    evalResult.followUp.shouldAsk &&
    followUpCount < env.MAX_FOLLOWUPS_PER_QUESTION;

  if (shouldFollowUp) return 'GENERATE_FU';
  if (answersCount >= env.MAX_QUESTIONS_PER_SESSION) return 'TERMINATE';
  return 'GENERATE_Q';
};

// ── Aggregate all evaluations into a scorecard ────────────────
export const aggregateScorecard = async (sessionId: string, userId: string) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId }).lean();
  if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND');

  const evaluations = await Evaluation.find({ sessionId }).lean();
  if (evaluations.length === 0)
    throw createError('No evaluations found', 404, 'NO_EVALUATIONS');

  const dims = ['technical', 'problemSolving', 'communication', 'confidence', 'conceptDepth'] as const;
  const totals: Record<string, number> = {};
  for (const d of dims) totals[d] = 0;

  for (const ev of evaluations) {
    for (const d of dims) totals[d] += (ev.scores as any)[d] ?? 0;
  }

  const n = evaluations.length;
  const avgScores: Record<string, number> = {};
  let overall = 0;
  for (const d of dims) {
    avgScores[d] = parseFloat((totals[d] / n).toFixed(2));
    overall += avgScores[d] * WEIGHTS[d];
  }
  overall = parseFloat(overall.toFixed(2));

  const strengths  = new Set<string>();
  const weaknesses = new Set<string>();
  const suggestions = new Set<string>();

  for (const ev of evaluations) {
    (ev.feedback as any)?.strengths?.forEach((s: string)    => strengths.add(s));
    (ev.feedback as any)?.weaknesses?.forEach((w: string)   => weaknesses.add(w));
    (ev.feedback as any)?.improvements?.forEach((i: string) => suggestions.add(i));
  }

  const scorecard = await Scorecard.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        userId,
        ...avgScores,
        overall,
        strengths:  [...strengths].slice(0, 10),
        weaknesses: [...weaknesses].slice(0, 10),
        suggestions:[...suggestions].slice(0, 10),
        questionsEvaluated: n,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await safeRedisDel(`session:${sessionId}`);

  emitScorecardReady(sessionId, scorecard);
  logger.info({ sessionId, overall, questionsEvaluated: n }, 'Scorecard aggregated');
  return scorecard;
};

// ── Get scorecard ─────────────────────────────────────────────
export const getScorecard = async (sessionId: string, userId: string) => {
  const sc = await Scorecard.findOne({ sessionId, userId }).lean();
  if (!sc) throw createError('Scorecard not found', 404, 'SCORECARD_NOT_FOUND');
  return sc;
};

export const getUserScorecards = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [scorecards, total] = await Promise.all([
    Scorecard.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'sessionId', select: 'role difficulty createdAt status' })
      .lean(),
    Scorecard.countDocuments({ userId }),
  ]);
  return { scorecards, total, page, pages: Math.ceil(total / limit) };
};