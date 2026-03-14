import { Worker, Job } from 'bullmq';
import { env } from '../config/env';
import { logger, logWorkerJob } from '../utils/logger';
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
  notifyWorkerError,
} from '../sockets';
import {
  EvaluateAnswerJob,
  GenerateQuestionJob,
  GenerateFollowUpJob,
  ComputeScorecardJob,
  ComputeRecommendationsJob,
  generateFollowUpQueue,
  bullRedisConnection,
} from '../queues';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ── Question Generation Worker ────────────────────────────────

export const questionWorker = new Worker(
  'generate-question',
  async (job: Job<GenerateQuestionJob>) => {
    const { sessionId, role, level, topic, previousQuestions } = job.data;
    const start = Date.now();

    logWorkerJob('generate-question', job.id ?? '', 'started');

    const { system, user } = buildQuestionGenerationPrompt({
      role,
      level,
      topic,
      previousQuestions,
      seed: uuidv4(),
    });

    const question = await aiAdapter.sendJSON<{
      id:               string;
      text:             string;
      type:             'concept' | 'problem' | 'behavioral';
      expectedKeywords: string[];
      difficulty:       string;
    }>(
      [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      { maxTokens: 400, temperature: 0.7 },
    );

    // Ensure unique question ID
    const questionWithMeta = {
      id:               `q_${uuidv4()}`,
      text:             question.text,
      type:             question.type ?? 'concept',
      topic,
      difficulty:       question.difficulty ?? level,
      expectedKeywords: Array.isArray(question.expectedKeywords) ? question.expectedKeywords : [],
      followUpCount:    0,
    };

    await addQuestionToSession(sessionId, questionWithMeta);
    notifyQuestionReady(sessionId, questionWithMeta);

    logWorkerJob('generate-question', job.id ?? '', 'completed', Date.now() - start);
    return { questionId: questionWithMeta.id };
  },
  {
    connection:  bullRedisConnection,
    concurrency: env.WORKER_CONCURRENCY_GENERATE,
  },
);

// ── Answer Evaluation Worker ──────────────────────────────────

export const evaluationWorker = new Worker(
  'evaluate-answer',
  async (job: Job<EvaluateAnswerJob>) => {
    const { sessionId, questionId, answerText, questionText, expectedKeywords, role, level } =
      job.data;
    const start = Date.now();

    logWorkerJob('evaluate-answer', job.id ?? '', 'started');

    const { system, user } = buildEvaluationPrompt({
      question:         questionText,
      answer:           answerText,
      expectedKeywords,
      role,
      level,
    });

    const promptHash = crypto
      .createHash('sha256')
      .update(system + user)
      .digest('hex')
      .slice(0, 12);

    const result = await aiAdapter.sendJSON<{
      scores: {
        technical:      number;
        communication:  number;
        problemSolving: number;
        confidence:     number;
        conceptDepth:   number;
      };
      detectedKeywords:  string[];
      missingKeywords:   string[];
      strengths:         string[];
      weaknesses:        string[];
      improvements:      string[];
      shouldAskFollowUp: boolean;
      followUpReason:    string;
    }>(
      [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      { maxTokens: 600, temperature: 0.2 },
    );

    // Clamp all scores to [0, 10]
    const clamp = (n: unknown): number => {
      const num = typeof n === 'number' ? n : parseFloat(String(n ?? '0'));
      return Math.max(0, Math.min(10, isNaN(num) ? 0 : Math.round(num * 10) / 10));
    };

    const scores = {
      technical:      clamp(result.scores?.technical),
      communication:  clamp(result.scores?.communication),
      problemSolving: clamp(result.scores?.problemSolving),
      confidence:     clamp(result.scores?.confidence),
      conceptDepth:   clamp(result.scores?.conceptDepth),
    };

    // Rules-based keyword boost: bump technical score for detected keywords AI missed
    const answerLower   = answerText.toLowerCase();
    const keywordsFound = (result.detectedKeywords ?? []).length > 0
      ? result.detectedKeywords
      : expectedKeywords.filter((k) => answerLower.includes(k.toLowerCase()));

    const missedByAI = expectedKeywords.filter(
      (k) => !result.detectedKeywords?.includes(k) && answerLower.includes(k.toLowerCase()),
    );
    if (missedByAI.length > 0) {
      const boost = Math.min(missedByAI.length * 0.5, 2);
      scores.technical = Math.min(10, scores.technical + boost);
      logger.debug({ missedByAI, boost }, 'Applied keyword boost');
    }

    const latencyMs = Date.now() - start;

    const evaluation = await Evaluation.create({
      sessionId,
      questionId,
      answerText,
      scores,
      detectedKeywords:    keywordsFound,
      missingKeywords:     result.missingKeywords ?? [],
      feedback: {
        strengths:    result.strengths    ?? [],
        weaknesses:   result.weaknesses   ?? [],
        improvements: result.improvements ?? [],
      },
      followUp: {
        shouldAsk: result.shouldAskFollowUp ?? false,
        reason:    result.followUpReason    ?? '',
      },
      promptHash,
      modelUsed:           env.OPENROUTER_DEFAULT_MODEL,
      evaluationLatencyMs: latencyMs,
    });

    // Link evaluation to session answer
    await InterviewSession.updateOne(
      { _id: sessionId, 'answers.questionId': questionId },
      { $set: { 'answers.$.evaluationId': evaluation._id } },
    );

    notifyEvaluationReady(sessionId, evaluation.toJSON());

    // Decide on follow-up
    const needsFollowUp =
      result.shouldAskFollowUp &&
      (scores.confidence  < env.CONFIDENCE_FOLLOWUP_THRESHOLD ||
       scores.conceptDepth < env.CONCEPT_DEPTH_FOLLOWUP_THRESHOLD);

    if (needsFollowUp) {
      const session = await InterviewSession.findById(sessionId).select('questions');
      const question = session?.questions.find((q) => q.id === questionId);
      const followUpCount = question?.followUpCount ?? 0;

      if (followUpCount < env.MAX_FOLLOWUPS_PER_QUESTION) {
        await generateFollowUpQueue.add(
          `fu:${sessionId}:${questionId}`,
          {
            sessionId,
            questionId,
            originalQuestion: questionText,
            candidateAnswer:  answerText,
            missingKeywords:  result.missingKeywords ?? [],
            weaknesses:       result.weaknesses      ?? [],
          } as GenerateFollowUpJob,
          { jobId: `fu:${sessionId}:${questionId}` },
        );
      }
    }

    logWorkerJob('evaluate-answer', job.id ?? '', 'completed', latencyMs);
    return { evaluationId: evaluation._id.toString() };
  },
  {
    connection:  bullRedisConnection,
    concurrency: env.WORKER_CONCURRENCY_EVALUATE,
  },
);

// ── Follow-up Generation Worker ───────────────────────────────

export const followUpWorker = new Worker(
  'generate-followup',
  async (job: Job<GenerateFollowUpJob>) => {
    const { sessionId, questionId, originalQuestion, candidateAnswer, missingKeywords, weaknesses } =
      job.data;
    const start = Date.now();

    logWorkerJob('generate-followup', job.id ?? '', 'started');

    const { system, user } = buildFollowUpPrompt({
      originalQuestion,
      candidateAnswer,
      missingKeywords,
      weaknesses,
    });

    const result = await aiAdapter.sendJSON<{ text: string }>(
      [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      { maxTokens: 200, temperature: 0.5 },
    );

    const followUpQuestion = {
      id:               `q_fu_${uuidv4()}`,
      text:             result.text,
      type:             'concept' as const,
      topic:            'follow-up',
      difficulty:       'mid',
      expectedKeywords: missingKeywords,
      followUpCount:    0,
      parentQuestionId: questionId,
    };

    await addQuestionToSession(sessionId, followUpQuestion);

    // Increment parent question follow-up counter
    await InterviewSession.updateOne(
      { _id: sessionId, 'questions.id': questionId },
      { $inc: { 'questions.$.followUpCount': 1 } },
    );

    notifyFollowUpReady(sessionId, followUpQuestion);

    logWorkerJob('generate-followup', job.id ?? '', 'completed', Date.now() - start);
    return { followUpId: followUpQuestion.id };
  },
  {
    connection:  bullRedisConnection,
    concurrency: env.WORKER_CONCURRENCY_GENERATE,
  },
);

// ── Scorecard Worker ──────────────────────────────────────────

export const scorecardWorker = new Worker(
  'compute-scorecard',
  async (job: Job<ComputeScorecardJob>) => {
    const { sessionId, userId } = job.data;
    const start = Date.now();

    logWorkerJob('compute-scorecard', job.id ?? '', 'started');

    const scorecard = await computeScorecard(sessionId, userId);

    logWorkerJob('compute-scorecard', job.id ?? '', 'completed', Date.now() - start);
    return { scorecardId: scorecard._id.toString() };
  },
  {
    connection:  bullRedisConnection,
    concurrency: env.WORKER_CONCURRENCY_SCORECARD,
  },
);

// ── Recommendations Worker ────────────────────────────────────

export const recommendationsWorker = new Worker(
  'compute-recommendations',
  async (job: Job<ComputeRecommendationsJob>) => {
    const { sessionId, userId } = job.data;
    const start = Date.now();

    logWorkerJob('compute-recommendations', job.id ?? '', 'started');

    await computeRecommendations(sessionId, userId);

    logWorkerJob('compute-recommendations', job.id ?? '', 'completed', Date.now() - start);
    return { done: true };
  },
  {
    connection:  bullRedisConnection,
    concurrency: env.WORKER_CONCURRENCY_RECOMMEND,
  },
);

// ── Shared error & completion handlers ───────────────────────

const allWorkers = [
  questionWorker,
  evaluationWorker,
  followUpWorker,
  scorecardWorker,
  recommendationsWorker,
];

for (const worker of allWorkers) {
  worker.on('failed', (job, err) => {
    const sid = (job?.data as { sessionId?: string })?.sessionId;
    logWorkerJob(worker.name, job?.id ?? '', 'failed', undefined, err.message);

    if (sid) {
      notifyWorkerError(sid, `Processing failed: ${err.message}`);
    }
  });

  worker.on('error', (err) => {
    logger.error({ queue: worker.name, err: err.message }, 'Worker error');
  });
}