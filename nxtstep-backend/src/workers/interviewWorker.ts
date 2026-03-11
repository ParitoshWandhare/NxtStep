import { Worker, Job } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { aiAdapter } from '../ai/aiAdapter';
import {
  buildQuestionGenerationPrompt,
  buildEvaluationPrompt,
  buildFollowUpPrompt,
} from '../ai/prompts';
import { Evaluation } from '../models/Evaluation';
import { InterviewSession } from '../models/InterviewSession';
import { addQuestionToSession } from '../services/interviewService';
import { computeScorecard } from '../services/scoringService';
import { computeRecommendations } from '../services/recommendationService';
import {
  notifyQuestionReady,
  notifyEvaluationReady,
  notifyFollowUpReady,
} from '../sockets';
import {
  EvaluateAnswerJob,
  GenerateQuestionJob,
  GenerateFollowUpJob,
  ComputeScorecardJob,
  ComputeRecommendationsJob,
  generateFollowUpQueue,
} from '../queues';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const connection = { url: env.REDIS_URL };

// ─── Question Generation Worker ───────────────────────────────────────────────

export const questionWorker = new Worker(
  'generate-question',
  async (job: Job<GenerateQuestionJob>) => {
    const { sessionId, role, level, topic, previousQuestions } = job.data;
    logger.debug(`Generating question: session=${sessionId} topic=${topic}`);

    const { system, user } = buildQuestionGenerationPrompt({
      role,
      level,
      topic,
      previousQuestions,
      seed: uuidv4(),
    });

    const question = await aiAdapter.sendJSON<{
      id: string;
      text: string;
      type: 'concept' | 'problem' | 'behavioral';
      expectedKeywords: string[];
      difficulty: string;
    }>([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], { maxTokens: 400 });

    // Ensure unique ID
    question.id = `q_${uuidv4()}`;

    const questionWithMeta = {
      ...question,
      topic,
      followUpCount: 0,
    };

    await addQuestionToSession(sessionId, questionWithMeta);

    try {
      notifyQuestionReady(sessionId, questionWithMeta);
    } catch {
      // Socket might not be initialized
    }

    logger.info(`Question generated: session=${sessionId} id=${question.id}`);
    return { questionId: question.id };
  },
  { connection, concurrency: 5 }
);

// ─── Answer Evaluation Worker ─────────────────────────────────────────────────

export const evaluationWorker = new Worker(
  'evaluate-answer',
  async (job: Job<EvaluateAnswerJob>) => {
    const { sessionId, questionId, answerText, questionText, expectedKeywords, role, level } = job.data;
    logger.debug(`Evaluating answer: session=${sessionId} question=${questionId}`);

    const { system, user } = buildEvaluationPrompt({
      question: questionText,
      answer: answerText,
      expectedKeywords,
      role,
      level,
    });

    const promptHash = crypto
      .createHash('md5')
      .update(system + user)
      .digest('hex');

    const result = await aiAdapter.sendJSON<{
      scores: { technical: number; communication: number; problemSolving: number; confidence: number; conceptDepth: number };
      detectedKeywords: string[];
      missingKeywords: string[];
      strengths: string[];
      weaknesses: string[];
      improvements: string[];
      shouldAskFollowUp: boolean;
      followUpReason: string;
    }>([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], { maxTokens: 600 });

    // Normalize scores to 0–10
    const normalizeScore = (n: unknown) => {
      const num = typeof n === 'number' ? n : parseFloat(String(n) || '0');
      return Math.max(0, Math.min(10, isNaN(num) ? 0 : num));
    };

    const normalizedScores = {
      technical: normalizeScore(result.scores?.technical),
      communication: normalizeScore(result.scores?.communication),
      problemSolving: normalizeScore(result.scores?.problemSolving),
      confidence: normalizeScore(result.scores?.confidence),
      conceptDepth: normalizeScore(result.scores?.conceptDepth),
    };

    // Rules-based boost: if expected keywords appear in answer, bump technical score slightly
    const answerLower = answerText.toLowerCase();
    const keywordsFound = expectedKeywords.filter((k) => answerLower.includes(k.toLowerCase()));
    if (keywordsFound.length > 0) {
      const boost = Math.min(keywordsFound.length * 0.3, 1.5);
      normalizedScores.technical = Math.min(10, normalizedScores.technical + boost);
    }

    const evaluation = await Evaluation.create({
      sessionId,
      questionId,
      answerText,
      scores: normalizedScores,
      detectedKeywords: result.detectedKeywords || keywordsFound,
      missingKeywords: result.missingKeywords || [],
      feedback: {
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        improvements: result.improvements || [],
      },
      followUp: {
        shouldAsk: result.shouldAskFollowUp ?? false,
        reason: result.followUpReason || '',
      },
      promptHash,
      modelUsed: env.OPENROUTER_DEFAULT_MODEL,
    });

    // Link evaluation back to answer in session
    await InterviewSession.updateOne(
      { _id: sessionId, 'answers.questionId': questionId },
      { $set: { 'answers.$.evaluationId': evaluation._id } }
    );

    try {
      notifyEvaluationReady(sessionId, evaluation.toJSON());
    } catch {
      // Socket might not be initialized
    }

    // Check if follow-up is needed
    const shouldFollowUp =
      result.shouldAskFollowUp &&
      (normalizedScores.confidence < env.CONFIDENCE_FOLLOWUP_THRESHOLD ||
        normalizedScores.conceptDepth < env.CONCEPT_DEPTH_FOLLOWUP_THRESHOLD);

    if (shouldFollowUp) {
      const session = await InterviewSession.findById(sessionId);
      const question = session?.questions.find((q) => q.id === questionId);
      const followUpCount = question?.followUpCount ?? 0;

      if (followUpCount < env.MAX_FOLLOWUPS_PER_QUESTION) {
        await generateFollowUpQueue.add('generate-followup', {
          sessionId,
          questionId,
          originalQuestion: questionText,
          candidateAnswer: answerText,
          missingKeywords: result.missingKeywords || [],
          weaknesses: result.weaknesses || [],
        } as GenerateFollowUpJob);
      }
    }

    logger.info(`Evaluation complete: session=${sessionId} question=${questionId} overall=${JSON.stringify(normalizedScores)}`);
    return { evaluationId: evaluation._id.toString() };
  },
  { connection, concurrency: 5 }
);

// ─── Follow-up Generation Worker ─────────────────────────────────────────────

export const followUpWorker = new Worker(
  'generate-followup',
  async (job: Job<GenerateFollowUpJob>) => {
    const { sessionId, questionId, originalQuestion, candidateAnswer, missingKeywords, weaknesses } = job.data;
    logger.debug(`Generating follow-up: session=${sessionId} parent=${questionId}`);

    const { system, user } = buildFollowUpPrompt({
      originalQuestion,
      candidateAnswer,
      missingKeywords,
      weaknesses,
    });

    const result = await aiAdapter.sendJSON<{ text: string }>([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], { maxTokens: 200 });

    const followUpQuestion = {
      id: `q_fu_${uuidv4()}`,
      text: result.text,
      type: 'concept' as const,
      topic: 'follow-up',
      difficulty: 'mid',
      expectedKeywords: missingKeywords,
      followUpCount: 0,
      parentQuestionId: questionId,
    };

    await addQuestionToSession(sessionId, followUpQuestion);

    // Increment parent question follow-up count
    await InterviewSession.updateOne(
      { _id: sessionId, 'questions.id': questionId },
      { $inc: { 'questions.$.followUpCount': 1 } }
    );

    try {
      notifyFollowUpReady(sessionId, followUpQuestion);
    } catch {
      // Socket might not be initialized
    }

    logger.info(`Follow-up generated: session=${sessionId} parent=${questionId}`);
    return { followUpId: followUpQuestion.id };
  },
  { connection, concurrency: 5 }
);

// ─── Scorecard Worker ─────────────────────────────────────────────────────────

export const scorecardWorker = new Worker(
  'compute-scorecard',
  async (job: Job<ComputeScorecardJob>) => {
    const { sessionId, userId } = job.data;
    logger.debug(`Computing scorecard: session=${sessionId}`);
    const scorecard = await computeScorecard(sessionId, userId);
    return { scorecardId: scorecard._id.toString() };
  },
  { connection, concurrency: 3 }
);

// ─── Recommendations Worker ───────────────────────────────────────────────────

export const recommendationsWorker = new Worker(
  'compute-recommendations',
  async (job: Job<ComputeRecommendationsJob>) => {
    const { sessionId, userId } = job.data;
    logger.debug(`Computing recommendations: session=${sessionId}`);
    await computeRecommendations(sessionId, userId);
    return { done: true };
  },
  { connection, concurrency: 3 }
);

// ─── Error handlers ───────────────────────────────────────────────────────────

[questionWorker, evaluationWorker, followUpWorker, scorecardWorker, recommendationsWorker].forEach(
  (worker) => {
    worker.on('failed', (job, err) => {
      logger.error(`Worker job failed: queue=${worker.name} job=${job?.id} error=${err.message}`);
    });
    worker.on('error', (err) => {
      logger.error(`Worker error: queue=${worker.name} error=${err.message}`);
    });
  }
);