// ============================================================
// NxtStep — Evaluation Service
// BUG FIX: Evaluation.create() was missing `answerText` field,
// causing Mongoose ValidationError: "answerText is required".
// The answerText is passed in as a parameter — it just wasn't
// being forwarded into the create() call.
// ============================================================

import crypto from 'crypto';
import { aiAdapter, AIMessage } from '../ai/aiAdapter';
import { buildEvaluationPrompt } from '../ai/prompts';
import { Evaluation } from '../models/Evaluation';
import { InterviewSession } from '../models/InterviewSession';
import { addGenerateQuestionJob } from '../queues';
import { safeRedisDel } from '../config/redis';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export interface EvalScores {
  technical: number;
  communication: number;
  problemSolving: number;
  confidence: number;
  conceptDepth: number;
}

export interface EvalResult {
  scores: EvalScores;
  detectedKeywords: string[];
  missingKeywords: string[];
  feedback: { strengths: string[]; weaknesses: string[]; improvements: string[] };
  followUp: { shouldAsk: boolean; reason: string; suggestedQuestion?: string };
  overall: number;
}

// ── Evaluate a single answer ─────────────────────────────────
export const evaluateAnswer = async (
  sessionId: string,
  questionId: string,
  userId: string,
  questionText: string,
  answerText: string,        // ← was already a param, just not forwarded to create()
  topic: string,
  difficulty: 'junior' | 'mid' | 'senior',
  questionIndex: number,
  totalQuestions: number,
  role: string
): Promise<EvalResult> => {
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

  const evalData = await aiAdapter.sendJSON<EvalResult>(messages, {
    temperature: 0.2,
    maxTokens: 1200,
  });

  const latencyMs = Date.now() - startTime;

  // Compute weighted overall
  const w = {
    technical:    env.SCORE_WEIGHT_TECHNICAL,
    problemSolving: env.SCORE_WEIGHT_PROBLEM_SOLVING,
    communication: env.SCORE_WEIGHT_COMMUNICATION,
    confidence:   env.SCORE_WEIGHT_CONFIDENCE,
    conceptDepth: env.SCORE_WEIGHT_CONCEPT_DEPTH,
  };
  const overall =
    evalData.scores.technical    * w.technical +
    evalData.scores.problemSolving * w.problemSolving +
    evalData.scores.communication  * w.communication +
    evalData.scores.confidence    * w.confidence +
    evalData.scores.conceptDepth  * w.conceptDepth;

  const promptHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(messages))
    .digest('hex')
    .slice(0, 12);

  // ── FIX: include `answerText` in the create payload ──────────
  await Evaluation.create({
    sessionId,
    questionId,
    answerText,                            // ← was missing before
    scores: evalData.scores,
    detectedKeywords: evalData.detectedKeywords ?? [],
    missingKeywords:  evalData.missingKeywords  ?? [],
    feedback: evalData.feedback ?? { strengths: [], weaknesses: [], improvements: [] },
    followUp: evalData.followUp ?? { shouldAsk: false, reason: 'Not required' },
    promptHash,
    modelUsed: env.OPENROUTER_DEFAULT_MODEL,
    evaluationLatencyMs: latencyMs,
  });

  // Update session state
  const session = await InterviewSession.findById(sessionId);
  if (session) {
    const question      = session.questions.find((q) => q.id === questionId);
    const followUpCount = (question as any)?.followUpCount ?? 0;
    const answersCount  = session.answers.length;

    const shouldAskFollowUp =
      evalData.followUp?.shouldAsk === true &&
      followUpCount < env.MAX_FOLLOWUPS_PER_QUESTION;

    if (shouldAskFollowUp && evalData.followUp.suggestedQuestion) {
      // Fast-path: AI already suggested a follow-up question text
      const fuQuestion = {
        id: `fu-${questionId}-${followUpCount + 1}`,
        text: evalData.followUp.suggestedQuestion,
        type: 'follow_up',
        topic,
        difficulty,
        expectedKeywords: [],
        followUpCount: 0,
        parentQuestionId: questionId,
      };
      session.questions.push(fuQuestion as any);
      if (question) (question as any).followUpCount = followUpCount + 1;
    } else if (answersCount >= env.MAX_QUESTIONS_PER_SESSION) {
      session.status = 'completed';
    } else {
      // Enqueue next question
      const askedTopics       = session.questions.map((q) => (q as any).topic ?? '');
      const askedQuestionIds  = session.questions.map((q) => q.id);
      await addGenerateQuestionJob({
        sessionId,
        userId,
        role: session.role,
        topic: askedTopics[answersCount] ?? role,
        difficulty: session.difficulty as 'junior' | 'mid' | 'senior',
        questionIndex: answersCount,
        askedTopics,
        askedQuestionIds,
      });
    }

    await session.save();
    await safeRedisDel(`session:${sessionId}`);
  }

  logger.info(
    { sessionId, questionId, overall: overall.toFixed(2), latencyMs },
    'Answer evaluated'
  );
  return { ...evalData, overall };
};