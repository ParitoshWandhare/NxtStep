import { Evaluation, IScores } from '../models/Evaluation';
import { Scorecard, IScorecard } from '../models/Scorecard';
import { InterviewSession } from '../models/InterviewSession';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { computeRecommendationsQueue } from '../queues';
import { notifyScorecardReady } from '../sockets';

const CATEGORY_WEIGHTS = {
  technical: env.WEIGHT_TECHNICAL,
  problemSolving: env.WEIGHT_PROBLEM_SOLVING,
  communication: env.WEIGHT_COMMUNICATION,
  confidence: env.WEIGHT_CONFIDENCE,
  conceptDepth: env.WEIGHT_CONCEPT_DEPTH,
};

// Problem-type questions have higher weight in final score
const QUESTION_TYPE_WEIGHTS: Record<string, number> = {
  problem: 1.5,
  concept: 1.0,
  behavioral: 0.8,
};

export const computeScorecard = async (sessionId: string, userId: string): Promise<IScorecard> => {
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const evaluations = await Evaluation.find({ sessionId });
  if (evaluations.length === 0) {
    logger.warn(`No evaluations found for session: ${sessionId} — creating empty scorecard`);
  }

  // Aggregate per-category scores using weighted average
  const categoryTotals: Record<keyof IScores, number> = {
    technical: 0, communication: 0, problemSolving: 0, confidence: 0, conceptDepth: 0,
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
          technical: round2(categoryTotals.technical / totalWeight),
          communication: round2(categoryTotals.communication / totalWeight),
          problemSolving: round2(categoryTotals.problemSolving / totalWeight),
          confidence: round2(categoryTotals.confidence / totalWeight),
          conceptDepth: round2(categoryTotals.conceptDepth / totalWeight),
        }
      : { technical: 0, communication: 0, problemSolving: 0, confidence: 0, conceptDepth: 0 };

  // Compute overall as weighted sum of category averages
  const overall = round2(
    avgScores.technical * CATEGORY_WEIGHTS.technical +
    avgScores.problemSolving * CATEGORY_WEIGHTS.problemSolving +
    avgScores.communication * CATEGORY_WEIGHTS.communication +
    avgScores.confidence * CATEGORY_WEIGHTS.confidence +
    avgScores.conceptDepth * CATEGORY_WEIGHTS.conceptDepth
  );

  // Aggregate feedback across all evaluations
  const allStrengths = evaluations.flatMap((e) => e.feedback.strengths);
  const allWeaknesses = evaluations.flatMap((e) => e.feedback.weaknesses);
  const allImprovements = evaluations.flatMap((e) => e.feedback.improvements);

  // Deduplicate feedback
  const strengths = [...new Set(allStrengths)].slice(0, 5);
  const weaknesses = [...new Set(allWeaknesses)].slice(0, 5);
  const suggestions = [...new Set(allImprovements)].slice(0, 5);

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
    { upsert: true, new: true }
  );

  // Link scorecard back to session
  await InterviewSession.findByIdAndUpdate(sessionId, { scorecardId: scorecard._id });

  logger.info(`Scorecard computed: session=${sessionId} overall=${overall}`);

  // Trigger recommendations
  await computeRecommendationsQueue.add('compute-recommendations', {
    sessionId,
    userId,
    scorecardId: scorecard._id.toString(),
  });

  try {
    notifyScorecardReady(sessionId, scorecard.toJSON());
  } catch {
    // Socket might not be initialized
  }

  return scorecard;
};

export const getScorecard = async (sessionId: string, userId: string): Promise<IScorecard> => {
  // Verify the session belongs to this user
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });

  const scorecard = await Scorecard.findOne({ sessionId });
  if (!scorecard) {
    throw Object.assign(new Error('Scorecard not ready yet'), { statusCode: 404 });
  }
  return scorecard;
};

export const getUserScorecards = async (userId: string): Promise<IScorecard[]> => {
  return Scorecard.find({ userId }).sort({ createdAt: -1 }).limit(20);
};

const round2 = (n: number): number => Math.round(n * 100) / 100;