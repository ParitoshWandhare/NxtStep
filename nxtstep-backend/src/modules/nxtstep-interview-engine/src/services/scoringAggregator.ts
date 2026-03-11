// ============================================================
// NxtStep Interview Engine — Scoring Aggregator
// Computes weighted scorecard from per-question evaluations.
// ============================================================

import {
  CategoryScore,
  EvaluationScores,
  InterviewQuestion,
  QuestionEvaluation,
  QuestionType,
  Scorecard,
  SessionContext,
} from '../types/interview.types';

// ─── Category weights ─────────────────────────────────────────
// These reflect NxtStep's priority on technical & problem-solving.

const CATEGORY_WEIGHTS: Record<keyof EvaluationScores, number> = {
  technical:      0.35,
  problemSolving: 0.25,
  communication:  0.20,
  confidence:     0.10,
  conceptDepth:   0.10,
};

// ─── Question-type weights ────────────────────────────────────
// Problem-solving questions matter more than behavioral ones.

const QUESTION_TYPE_WEIGHTS: Record<QuestionType, number> = {
  problem:    1.5,
  concept:    1.0,
  behavioral: 0.7,
};

// ─── Per-category weighted average ───────────────────────────

function computeCategoryScore(
  category: keyof EvaluationScores,
  evaluations: QuestionEvaluation[],
  questions:   InterviewQuestion[],
): number {
  let weightedSum  = 0;
  let totalWeight  = 0;

  for (const evaluation of evaluations) {
    const question = questions.find(q => q.id === evaluation.questionId);
    const typeWeight = question
      ? (QUESTION_TYPE_WEIGHTS[question.type] ?? 1.0)
      : 1.0;

    weightedSum += typeWeight * evaluation.scores[category];
    totalWeight += typeWeight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10) / 10;  // 1 decimal place
}

// ─── Aggregate scorecard ──────────────────────────────────────

export function computeScorecard(params: {
  context:     SessionContext;
  questions:   InterviewQuestion[];
  evaluations: QuestionEvaluation[];
  totalFollowUps: number;
}): Scorecard {
  const { context, questions, evaluations, totalFollowUps } = params;

  // Only use non-follow-up evaluations for primary scoring
  // (follow-ups are used as supplements, not double-counted)
  const primaryEvals = evaluations.filter(ev => {
    const q = questions.find(q => q.id === ev.questionId);
    return q && !q.isFollowUp;
  });

  const categoryScores: Record<keyof EvaluationScores, CategoryScore> =
    {} as Record<keyof EvaluationScores, CategoryScore>;

  const categories = Object.keys(CATEGORY_WEIGHTS) as (keyof EvaluationScores)[];

  for (const category of categories) {
    categoryScores[category] = {
      score:  computeCategoryScore(category, primaryEvals, questions),
      weight: CATEGORY_WEIGHTS[category],
    };
  }

  // Overall = weighted sum of category scores
  const overallScore = categories.reduce((acc, category) => {
    return acc + categoryScores[category].score * CATEGORY_WEIGHTS[category];
  }, 0);

  const scorecard: Scorecard = {
    sessionId:      context.sessionId,
    userId:         context.userId,
    role:           context.role,
    level:          context.level,
    categoryScores,
    overallScore:   Math.round(overallScore * 10) / 10,
    totalQuestions: questions.filter(q => !q.isFollowUp).length,
    totalFollowUps,
    generatedAt:    new Date(),
  };

  console.log(
    `[ScoringAggregator] Session ${context.sessionId} | ` +
    `Overall: ${scorecard.overallScore}/10 | ` +
    `Tech: ${categoryScores.technical.score} | ` +
    `PS: ${categoryScores.problemSolving.score} | ` +
    `Comm: ${categoryScores.communication.score}`
  );

  return scorecard;
}

// ─── Score tier classification ────────────────────────────────

export type ScoreTier = 'excellent' | 'strong' | 'adequate' | 'developing' | 'insufficient';

export function classifyScore(score: number): ScoreTier {
  if (score >= 8.5) return 'excellent';
  if (score >= 7.0) return 'strong';
  if (score >= 5.5) return 'adequate';
  if (score >= 4.0) return 'developing';
  return 'insufficient';
}

/**
 * Returns a flat score map (category → score) used by the
 * recommendation engine's matching pipeline.
 */
export function scorecardToFlatMap(
  scorecard: Scorecard,
): Record<string, number> {
  const flat: Record<string, number> = {
    overall: scorecard.overallScore,
  };
  for (const [cat, cs] of Object.entries(scorecard.categoryScores)) {
    flat[cat] = (cs as CategoryScore).score;
  }
  return flat;
}
