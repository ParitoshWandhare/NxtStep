// ============================================================
// NxtStep Interview Engine — Answer Evaluator
// Calls AI to score answers, normalizes output, applies
// rules-based keyword boost, and decides on follow-ups.
// ============================================================

import { aiAdapter } from '../ai/aiAdapter';
import { buildEvaluationPrompt } from '../ai/prompts';
import {
  EvaluationScores,
  InterviewQuestion,
  QuestionEvaluation,
  RawEvaluationOutput,
} from '../types/interview.types';

// ─── Score normalization ──────────────────────────────────────

const SCORE_MIN = 0;
const SCORE_MAX = 10;

function clamp(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 5;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(value)));
}

function normalizeScores(raw: Partial<EvaluationScores>): EvaluationScores {
  return {
    technical:      clamp(raw.technical      ?? 0),
    communication:  clamp(raw.communication  ?? 0),
    problemSolving: clamp(raw.problemSolving ?? 0),
    confidence:     clamp(raw.confidence     ?? 0),
    conceptDepth:   clamp(raw.conceptDepth   ?? 0),
  };
}

// ─── Rules-based keyword boost ────────────────────────────────

/**
 * If the answer text contains expected keywords that the AI missed,
 * bump the technical score by 0.5 per matched keyword (max +2).
 */
function applyKeywordBoost(
  scores: EvaluationScores,
  answerText: string,
  expectedKeywords: string[],
  detectedByAI: string[],
): EvaluationScores {
  if (!expectedKeywords.length) return scores;

  const lowerAnswer = answerText.toLowerCase();
  const missedByAI  = expectedKeywords.filter(
    kw => !detectedByAI.includes(kw) && lowerAnswer.includes(kw.toLowerCase())
  );

  const boost  = Math.min(missedByAI.length * 0.5, 2);
  const newScore = clamp(scores.technical + boost);

  if (boost > 0) {
    console.log(
      `[Evaluator] Keyword boost +${boost} for keywords: [${missedByAI.join(', ')}]`
    );
  }

  return { ...scores, technical: newScore };
}

// ─── Follow-up decision ───────────────────────────────────────

const CONFIDENCE_THRESHOLD   = Number(process.env.CONFIDENCE_FOLLOWUP_THRESHOLD)   || 5;
const CONCEPT_DEPTH_THRESHOLD = Number(process.env.CONCEPT_DEPTH_FOLLOWUP_THRESHOLD) || 5;
const MAX_FOLLOWUPS           = Number(process.env.MAX_FOLLOWUPS_PER_QUESTION)       || 2;

export function shouldAskFollowUp(params: {
  aiRecommends:    boolean;
  scores:          EvaluationScores;
  followUpCount:   number;
}): boolean {
  const { aiRecommends, scores, followUpCount } = params;
  if (followUpCount >= MAX_FOLLOWUPS) return false;

  const scoreBasedTrigger =
    scores.confidence  < CONFIDENCE_THRESHOLD ||
    scores.conceptDepth < CONCEPT_DEPTH_THRESHOLD;

  return aiRecommends && scoreBasedTrigger;
}

// ─── Main evaluator ───────────────────────────────────────────

export async function evaluateAnswer(params: {
  sessionId:  string;
  question:   InterviewQuestion;
  answerText: string;
}): Promise<QuestionEvaluation> {
  const { sessionId, question, answerText } = params;

  if (!answerText?.trim()) {
    // Handle empty / skipped answers
    return buildEmptyEvaluation(sessionId, question);
  }

  const { system, user } = buildEvaluationPrompt({
    question:         question.text,
    answer:           answerText,
    expectedKeywords: question.expectedKeywords,
    questionType:     question.type,
  });

  const messages = aiAdapter.buildMessages(system, user);
  const response = await aiAdapter.sendJSON<RawEvaluationOutput>(messages, {
    temperature: 0.2,   // Low temperature for consistent scoring
    maxTokens:   600,
  });

  const raw = response.data;

  // Normalize scores into 0–10 range
  let scores = normalizeScores(raw.scores ?? {});

  // Apply rules-based keyword boost
  scores = applyKeywordBoost(
    scores,
    answerText,
    question.expectedKeywords,
    raw.detectedKeywords ?? [],
  );

  const askFollowUp = shouldAskFollowUp({
    aiRecommends:  raw.shouldAskFollowUp ?? false,
    scores,
    followUpCount: question.followUpCount,
  });

  const evaluation: QuestionEvaluation = {
    questionId:       question.id,
    sessionId,
    answerText,
    scores,
    feedback: {
      strengths:    Array.isArray(raw.strengths)    ? raw.strengths    : [],
      weaknesses:   Array.isArray(raw.weaknesses)   ? raw.weaknesses   : [],
      improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
    },
    followUp: {
      shouldAsk:       askFollowUp,
      reason:          askFollowUp
        ? `Low scores: confidence=${scores.confidence}, conceptDepth=${scores.conceptDepth}`
        : 'No follow-up needed',
      missingKeywords: raw.missingKeywords ?? [],
    },
    detectedKeywords: raw.detectedKeywords ?? [],
    promptHash:       response.promptHash,
    evaluatedAt:      new Date(),
  };

  console.log(
    `[Evaluator] ${question.id} | ` +
    `tech=${scores.technical} comm=${scores.communication} ` +
    `ps=${scores.problemSolving} conf=${scores.confidence} cd=${scores.conceptDepth} | ` +
    `followUp=${askFollowUp} | latency=${response.latencyMs}ms`
  );

  return evaluation;
}

// ─── Empty answer handler ──────────────────────────────────────

function buildEmptyEvaluation(
  sessionId: string,
  question:  InterviewQuestion,
): QuestionEvaluation {
  return {
    questionId:       question.id,
    sessionId,
    answerText:       '',
    scores:           { technical: 0, communication: 0, problemSolving: 0, confidence: 0, conceptDepth: 0 },
    feedback: {
      strengths:    [],
      weaknesses:   ['No answer provided'],
      improvements: ['Please attempt to answer even if uncertain'],
    },
    followUp: {
      shouldAsk:       false,
      reason:          'No answer provided',
      missingKeywords: [],
    },
    detectedKeywords: [],
    evaluatedAt:      new Date(),
  };
}
