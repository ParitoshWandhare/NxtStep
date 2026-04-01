// ============================================================
// NxtStep — Scoring Service
// FIX: Previously saved dimension scores nested inside a
// `scores: {}` sub-object but the Scorecard Mongoose model
// has them as flat top-level fields (technical, problemSolving,
// communication, confidence, conceptDepth, overall).
// The $set payload now spreads them at the top level so they
// are actually persisted and returned correctly.
// ============================================================

import { Evaluation } from '../models/Evaluation';
import { Scorecard } from '../models/Scorecard';
import { InterviewSession } from '../models/InterviewSession';
import { emitScorecardReady } from '../sockets/index';
import { safeRedisDel } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';

const SCORE_WEIGHTS = {
  technical:      env.SCORE_WEIGHT_TECHNICAL,
  problemSolving: env.SCORE_WEIGHT_PROBLEM_SOLVING,
  communication:  env.SCORE_WEIGHT_COMMUNICATION,
  confidence:     env.SCORE_WEIGHT_CONFIDENCE,
  conceptDepth:   env.SCORE_WEIGHT_CONCEPT_DEPTH,
};

export const generateScorecard = async (sessionId: string, userId: string) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND');

  const evaluations = await Evaluation.find({ sessionId }).lean();
  if (evaluations.length === 0)
    throw createError('No evaluations found', 404, 'NO_EVALUATIONS');

  // ── Aggregate dimension scores (mean across all questions) ──
  const dimensions = [
    'technical', 'problemSolving', 'communication', 'confidence', 'conceptDepth',
  ] as const;

  const dimTotals: Record<string, number> = {
    technical: 0, problemSolving: 0, communication: 0,
    confidence: 0, conceptDepth: 0,
  };

  for (const ev of evaluations) {
    for (const dim of dimensions) {
      // ev.scores is the sub-document from Evaluation model
      dimTotals[dim] += (ev.scores as any)[dim] ?? 0;
    }
  }

  const n = evaluations.length;
  const avgScores: Record<string, number> = {};
  let overall = 0;

  for (const dim of dimensions) {
    avgScores[dim] = parseFloat((dimTotals[dim] / n).toFixed(2));
    overall += avgScores[dim] * SCORE_WEIGHTS[dim];
  }
  overall = parseFloat(overall.toFixed(2));

  // ── Collect feedback strings ────────────────────────────────
  const strengths  = new Set<string>();
  const weaknesses = new Set<string>();
  const suggestions = new Set<string>();

  for (const ev of evaluations) {
    ev.feedback?.strengths?.forEach((s: string)    => strengths.add(s));
    ev.feedback?.weaknesses?.forEach((w: string)   => weaknesses.add(w));
    ev.feedback?.improvements?.forEach((i: string) => suggestions.add(i));
  }

  // ── Upsert scorecard with FLAT fields (not nested scores:{}) ─
  // The Scorecard model schema defines: technical, problemSolving,
  // communication, confidence, conceptDepth, overall as top-level
  // Number fields. Nesting them inside `scores:{}` causes them to
  // be ignored by Mongoose and always read back as 0.
  const scorecard = await Scorecard.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        userId,
        // Flat top-level fields matching the Mongoose schema:
        technical:      avgScores.technical,
        problemSolving: avgScores.problemSolving,
        communication:  avgScores.communication,
        confidence:     avgScores.confidence,
        conceptDepth:   avgScores.conceptDepth,
        overall,
        strengths:        [...strengths].slice(0, 10),
        weaknesses:       [...weaknesses].slice(0, 10),
        suggestions:      [...suggestions].slice(0, 10),
        questionsEvaluated: n,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // Invalidate Redis cache for this session
  await safeRedisDel(`session:${sessionId}`);

  // Notify frontend via Socket.IO
  emitScorecardReady(sessionId, scorecard);

  logger.info({ sessionId, overall, n }, 'Scorecard generated');
  return scorecard;
};

export const getScorecard = async (sessionId: string, userId: string) => {
  const scorecard = await Scorecard.findOne({ sessionId, userId }).lean();
  if (!scorecard) throw createError('Scorecard not found', 404, 'SCORECARD_NOT_FOUND');
  return scorecard;
};

export const getUserScorecards = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [scorecards, total] = await Promise.all([
    Scorecard.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'sessionId', select: 'role difficulty createdAt completedAt status' })
      .lean(),
    Scorecard.countDocuments({ userId }),
  ]);
  return { scorecards, total, page, pages: Math.ceil(total / limit) };
};