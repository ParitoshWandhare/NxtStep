// ============================================================
// NxtStep — Evaluation Service
// Called by the evaluate worker after answer submission.
// ============================================================

import { aiAdapter } from '../ai/aiAdapter';
import { buildEvaluationPrompt, buildFollowUpPrompt } from '../ai/prompts';
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
  answerText: string,
  topic: string,
  difficulty: 'junior' | 'mid' | 'senior',
  questionIndex: number,
  totalQuestions: number,
  role: string
): Promise<EvalResult> => {
  const startTime = Date.now();

  const prompt = buildEvaluationPrompt({
    role, topic, difficulty, questionText, answerText, questionIndex, totalQuestions,
  });

  const evalData = await aiAdapter.sendJSON<EvalResult>(prompt, {
    temperature: 0.2,
    maxTokens: 1200,
  });

  const latencyMs = Date.now() - startTime;

  // Compute weighted overall
  const w = {
    technical: env.SCORE_WEIGHT_TECHNICAL,
    problemSolving: env.SCORE_WEIGHT_PROBLEM_SOLVING,
    communication: env.SCORE_WEIGHT_COMMUNICATION,
    confidence: env.SCORE_WEIGHT_CONFIDENCE,
    conceptDepth: env.SCORE_WEIGHT_CONCEPT_DEPTH,
  };
  const overall =
    evalData.scores.technical * w.technical +
    evalData.scores.problemSolving * w.problemSolving +
    evalData.scores.communication * w.communication +
    evalData.scores.confidence * w.confidence +
    evalData.scores.conceptDepth * w.conceptDepth;

  // Persist evaluation
  await Evaluation.create({
    sessionId,
    questionId,
    userId,
    scores: evalData.scores,
    detectedKeywords: evalData.detectedKeywords ?? [],
    missingKeywords: evalData.missingKeywords ?? [],
    feedback: evalData.feedback ?? { strengths: [], weaknesses: [], improvements: [] },
    followUp: evalData.followUp ?? { shouldAsk: false, reason: 'Not required' },
    promptHash: aiAdapter.hashPrompt(prompt),
    modelUsed: env.AI_MODEL,
    evaluationLatencyMs: latencyMs,
  });

  // Update session engineState
  const session = await InterviewSession.findById(sessionId);
  if (session) {
    const question = session.questions.find((q) => q.id === questionId);
    const followUpCount = question?.followUpCount ?? 0;
    const answersCount = session.answers.length;
    const shouldAskFollowUp =
      evalData.followUp?.shouldAsk &&
      followUpCount < env.INTERVIEW_MAX_FOLLOWUPS_PER_QUESTION;

    if (shouldAskFollowUp && evalData.followUp.suggestedQuestion) {
      // Generate follow-up inline (fast path: AI already suggested it)
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
      session.engineState = 'AWAIT_FU_ANSWER';
      if (question) (question as any).followUpCount = followUpCount + 1;
    } else if (answersCount >= env.INTERVIEW_MAX_QUESTIONS) {
      session.engineState = 'TERMINATE';
      session.status = 'completed';
      session.completedAt = new Date();
    } else {
      session.engineState = 'GENERATE_Q';
      // Enqueue next question
      const askedTopics = session.questions.map((q) => q.topic);
      const askedQuestionIds = session.questions.map((q) => q.id);
      await addGenerateQuestionJob({
        sessionId,
        userId,
        role: session.role,
        topic: session.customTopics?.[answersCount] ?? role,
        difficulty: session.difficulty as any,
        questionIndex: answersCount,
        askedTopics,
        askedQuestionIds,
      });
    }

    await session.save();
    await safeRedisDel(`session:${sessionId}`);
  }

  logger.info({ sessionId, questionId, overall: overall.toFixed(2), latencyMs }, 'Answer evaluated');
  return { ...evalData, overall };
};
