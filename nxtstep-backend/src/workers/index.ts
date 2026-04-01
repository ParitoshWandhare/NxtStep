// ============================================================
// NxtStep — BullMQ Workers (all in one file for clarity)
// FIX: All workers now share a single IORedis connection via
// sharedBullConnection instead of each opening their own, and
// concurrency is lowered to reduce total connection count.
// ============================================================

import { Worker, Job } from 'bullmq';
import { sharedBullConnection } from '../config/bullmq-connection';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  QUEUE_NAMES,
  EvaluateAnswerJobData,
  GenerateQuestionJobData,
  GenerateScorecardJobData,
  RecommendRolesJobData,
  IngestNewsJobData,
} from '../queues';

// Shared worker options — single connection, conservative concurrency
// to avoid Redis client limit exhaustion on hobby/free plans.
const workerConcurrency = Math.min(env.WORKER_CONCURRENCY ?? 2, 2);

// ── Evaluate Answer Worker ───────────────────────────────────
export const evaluateWorker = new Worker<EvaluateAnswerJobData>(
  QUEUE_NAMES.EVALUATE_ANSWER,
  async (job: Job<EvaluateAnswerJobData>) => {
    const { evaluateAnswer } = await import('../services/evaluationService');
    logger.info({ jobId: job.id, sessionId: job.data.sessionId }, 'Evaluating answer');
    await evaluateAnswer(
      job.data.sessionId,
      job.data.questionId,
      job.data.userId,
      job.data.questionText,
      job.data.answerText,
      job.data.topic,
      job.data.difficulty,
      job.data.questionIndex,
      job.data.totalQuestions,
      job.data.role
    );
  },
  { connection: sharedBullConnection, concurrency: workerConcurrency }
);

// ── Generate Question Worker ─────────────────────────────────
export const generateQuestionWorker = new Worker<GenerateQuestionJobData>(
  QUEUE_NAMES.GENERATE_QUESTION,
  async (job: Job<GenerateQuestionJobData>) => {
    const { aiAdapter } = await import('../ai/aiAdapter');
    const { buildQuestionGenerationPrompt } = await import('../ai/prompts');
    const { InterviewSession } = await import('../models/InterviewSession');
    const { safeRedisDel } = await import('../config/redis');

    logger.info({ jobId: job.id, sessionId: job.data.sessionId }, 'Generating question');

    const prompt = buildQuestionGenerationPrompt({
      role: job.data.role,
      level: job.data.difficulty,
      topic: job.data.topic,
      previousQuestions: job.data.askedTopics,
      seed: `${job.data.sessionId}-${job.data.questionIndex}`,
    });

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ];

    const question = await aiAdapter.sendJSON<{
      id: string;
      text: string;
      type: "concept" | "problem" | "behavioral";
      expectedKeywords: string[];
      difficulty: string;
    }>(messages, { temperature: 0.6, maxTokens: 600 });

    const newQuestion = {
      id: `q-${job.data.questionIndex}-${Date.now()}`,
      text: question.text,
      type: question.type ?? 'technical',
      topic: job.data.topic,
      difficulty: job.data.difficulty,
      expectedKeywords: question.expectedKeywords ?? [],
      followUpCount: 0,
    };

    await InterviewSession.updateOne(
      { _id: job.data.sessionId },
      {
        $push: { questions: newQuestion },
        $set: { engineState: 'AWAIT_ANSWER' },
      }
    );

    await safeRedisDel(`session:${job.data.sessionId}`);
    logger.info({ sessionId: job.data.sessionId, questionId: newQuestion.id }, 'Question generated');
  },
  { connection: sharedBullConnection, concurrency: workerConcurrency }
);

// ── Scorecard Worker ─────────────────────────────────────────
export const scorecardWorker = new Worker<GenerateScorecardJobData>(
  QUEUE_NAMES.GENERATE_SCORECARD,
  async (job: Job<GenerateScorecardJobData>) => {
    const { generateScorecard } = await import('../services/scoringService');
    const { addRecommendRolesJob } = await import('../queues');

    logger.info({ jobId: job.id, sessionId: job.data.sessionId }, 'Generating scorecard');
    await generateScorecard(job.data.sessionId, job.data.userId);

    // Chain: after scorecard → recommendations
    await addRecommendRolesJob({ sessionId: job.data.sessionId, userId: job.data.userId });
  },
  { connection: sharedBullConnection, concurrency: 1 }
);

// ── Recommend Roles Worker ───────────────────────────────────
export const recommendWorker = new Worker<RecommendRolesJobData>(
  QUEUE_NAMES.RECOMMEND_ROLES,
  async (job: Job<RecommendRolesJobData>) => {
    const { generateRecommendations } = await import('../services/recommendationService');
    logger.info({ jobId: job.id, sessionId: job.data.sessionId }, 'Generating recommendations');
    await generateRecommendations(job.data.sessionId, job.data.userId);
  },
  { connection: sharedBullConnection, concurrency: 1 }
);

// ── News Ingestion Worker ────────────────────────────────────
export const newsWorker = new Worker<IngestNewsJobData>(
  QUEUE_NAMES.INGEST_NEWS,
  async (job: Job<IngestNewsJobData>) => {
    const { runNewsIngestion } = await import('../services/newsIngestionService');
    logger.info({ jobId: job.id }, 'Running news ingestion');
    const count = await runNewsIngestion();
    logger.info({ count }, 'News ingestion worker done');
  },
  { connection: sharedBullConnection, concurrency: 1 }
);

// ── Shared error handlers ────────────────────────────────────
const workers = [evaluateWorker, generateQuestionWorker, scorecardWorker, recommendWorker, newsWorker];

for (const worker of workers) {
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: worker.name, err }, 'Job failed');
  });
  worker.on('error', (err) => {
    logger.error({ queue: worker.name, err }, 'Worker error');
  });
}

// ── Graceful shutdown ────────────────────────────────────────
// Closes all worker polling loops. The shared Redis connection
// itself is closed separately via closeBullConnection() in server.ts
// shutdown sequence, AFTER this function resolves.
export const closeAllWorkers = async () => {
  await Promise.allSettled(workers.map((w) => w.close()));
  logger.info('All workers closed');
};