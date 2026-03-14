import { Evaluation, IScores } from '../models/Evaluation';
import { Scorecard, IScorecard } from '../models/Scorecard';
import { InterviewSession } from '../models/InterviewSession';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { computeRecommendationsQueue } from '../queues';
import { notifyScorecardReady } from '../sockets';
import { createError } from '../middleware/errorHandler';


// ── Weights loaded from environment ──────────────────────────

const CATEGORY_WEIGHTS: Record<keyof IScores, number> = {
  technical:      env.WEIGHT_TECHNICAL,
  problemSolving: env.WEIGHT_PROBLEM_SOLVING,
  communication:  env.WEIGHT_COMMUNICATION,
  confidence:     env.WEIGHT_CONFIDENCE,
  conceptDepth:   env.WEIGHT_CONCEPT_DEPTH,
};

// Problem-type questions count more toward the final score
const QUESTION_TYPE_WEIGHTS: Record<string, number> = {
  problem:    1.5,
  concept:    1.0,
  behavioral: 0.8,
};

// ── Compute scorecard ─────────────────────────────────────────

export const computeScorecard = async (
  sessionId: string,
  userId: string,
): Promise<IScorecard> => {
  const [session, evaluations] = await Promise.all([
    InterviewSession.findById(sessionId),
    Evaluation.find({ sessionId }),
  ]);

  if (!session) throw createError(`Session not found: ${sessionId}`, 404);

  if (evaluations.length === 0) {
    logger.warn({ sessionId }, 'No evaluations found — creating zero scorecard');
  }

  // ── Compute question-type-weighted average per category ───────
  //
  // FIX: Original code had totalWeight only incremented inside the loop
  //      but referenced outside — now correctly scoped.

  const categoryTotals: Record<keyof IScores, number> = {
    technical: 0,
    communication: 0,
    problemSolving: 0,
    confidence: 0,
    conceptDepth: 0,
  };

  let totalWeight = 0;

  for (const evaluation of evaluations) {
    const question = session.questions.find((q) => q.id === evaluation.questionId);
    const questionWeight = question
      ? (QUESTION_TYPE_WEIGHTS[question.type] ?? 1.0)
      : 1.0;

    totalWeight += questionWeight;

    for (const category of Object.keys(categoryTotals) as Array<keyof IScores>) {
      categoryTotals[category] += questionWeight * (evaluation.scores[category] ?? 0);
    }
  }

  const avgScores: IScores =
    totalWeight > 0
      ? {
          technical:      round2(categoryTotals.technical      / totalWeight),
          communication:  round2(categoryTotals.communication  / totalWeight),
          problemSolving: round2(categoryTotals.problemSolving / totalWeight),
          confidence:     round2(categoryTotals.confidence     / totalWeight),
          conceptDepth:   round2(categoryTotals.conceptDepth   / totalWeight),
        }
      : {
          technical: 0,
          communication: 0,
          problemSolving: 0,
          confidence: 0,
          conceptDepth: 0,
        };

  // ── Overall = weighted sum of category averages ───────────────

  const overall = round2(
    avgScores.technical      * CATEGORY_WEIGHTS.technical      +
    avgScores.problemSolving * CATEGORY_WEIGHTS.problemSolving +
    avgScores.communication  * CATEGORY_WEIGHTS.communication  +
    avgScores.confidence     * CATEGORY_WEIGHTS.confidence     +
    avgScores.conceptDepth   * CATEGORY_WEIGHTS.conceptDepth,
  );

  // ── Aggregate and deduplicate feedback ────────────────────────

  const allStrengths    = evaluations.flatMap((e) => e.feedback.strengths);
  const allWeaknesses   = evaluations.flatMap((e) => e.feedback.weaknesses);
  const allImprovements = evaluations.flatMap((e) => e.feedback.improvements);

  const strengths   = [...new Set(allStrengths)].slice(0, 5);
  const weaknesses  = [...new Set(allWeaknesses)].slice(0, 5);
  const suggestions = [...new Set(allImprovements)].slice(0, 5);

  // ── Upsert scorecard ──────────────────────────────────────────

  const scorecard = await Scorecard.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      userId,
      ...avgScores,
      overall,
      strengths,
      weaknesses,
      suggestions,
      questionsEvaluated: evaluations.length,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // ── Link scorecard back to session ────────────────────────────

  await InterviewSession.findByIdAndUpdate(sessionId, {
    scorecardId: scorecard._id,
    status: 'completed',
  });

  logger.info(
    {
      sessionId,
      overall,
      technical: avgScores.technical,
      problemSolving: avgScores.problemSolving,
      questionsEvaluated: evaluations.length,
    },
    'Scorecard computed',
  );

  // ── Trigger downstream recommendations ───────────────────────

  await computeRecommendationsQueue.add(
    `recommendations:${sessionId}`,
    { sessionId, userId, scorecardId: scorecard._id.toString() },
    { jobId: `rec:${sessionId}`, removeOnComplete: { count: 10 } },
  );

  // ── Notify connected client via WebSocket ─────────────────────

  try {
    notifyScorecardReady(sessionId, scorecard.toJSON());
  } catch {
    // Socket not initialized in worker process — this is expected
  }

  return scorecard;
};

// ── Get scorecard (with ownership check) ──────────────────────

export const getScorecard = async (
  sessionId: string,
  userId: string,
): Promise<IScorecard> => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) throw createError('Session not found', 404);

  const scorecard = await Scorecard.findOne({ sessionId });
  if (!scorecard) {
    throw createError(
      'Scorecard not ready yet — interview is still being evaluated',
      404,
    );
  }

  return scorecard;
};

// ── Get all scorecards for a user ─────────────────────────────

export const getUserScorecards = async (userId: string) => {
  return Scorecard.find({ userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()
    .exec();
};

// ── Helpers ───────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;