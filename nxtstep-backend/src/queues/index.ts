// ============================================================
// NxtStep — BullMQ Queue Definitions & Job Types
// FIX: All queues now share a single IORedis connection via
// sharedBullConnection to prevent connection pool exhaustion.
// ============================================================

import { Queue, QueueOptions } from 'bullmq';
import { sharedBullConnection } from '../config/bullmq-connection';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const defaultQueueOpts: QueueOptions = {
  connection: sharedBullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500, age: 60 * 60 * 24 },
    removeOnFail: { count: 1000, age: 60 * 60 * 24 * 7 },
  },
};

// ── Queue Names ──────────────────────────────────────────────
export const QUEUE_NAMES = {
  EVALUATE_ANSWER: 'evaluate-answer',
  GENERATE_QUESTION: 'generate-question',
  GENERATE_SCORECARD: 'generate-scorecard',
  RECOMMEND_ROLES: 'recommend-roles',
  INGEST_NEWS: 'ingest-news',
} as const;

// ── Queue Instances ──────────────────────────────────────────
export const evaluateAnswerQueue = new Queue(QUEUE_NAMES.EVALUATE_ANSWER, defaultQueueOpts);
export const generateQuestionQueue = new Queue(QUEUE_NAMES.GENERATE_QUESTION, defaultQueueOpts);
export const generateScorecardQueue = new Queue(QUEUE_NAMES.GENERATE_SCORECARD, {
  ...defaultQueueOpts,
  defaultJobOptions: { ...defaultQueueOpts.defaultJobOptions, attempts: 2 },
});
export const recommendRolesQueue = new Queue(QUEUE_NAMES.RECOMMEND_ROLES, defaultQueueOpts);
export const ingestNewsQueue = new Queue(QUEUE_NAMES.INGEST_NEWS, {
  ...defaultQueueOpts,
  defaultJobOptions: {
    ...defaultQueueOpts.defaultJobOptions,
    attempts: 2,
  },
});

// ── Job Data Types ───────────────────────────────────────────
export interface EvaluateAnswerJobData {
  sessionId: string;
  questionId: string;
  userId: string;
  questionText: string;
  answerText: string;
  topic: string;
  difficulty: 'junior' | 'mid' | 'senior';
  questionIndex: number;
  totalQuestions: number;
  role: string;
}

export interface GenerateQuestionJobData {
  sessionId: string;
  userId: string;
  role: string;
  topic: string;
  difficulty: 'junior' | 'mid' | 'senior';
  questionIndex: number;
  askedTopics: string[];
  askedQuestionIds: string[];
}

export interface GenerateScorecardJobData {
  sessionId: string;
  userId: string;
}

export interface RecommendRolesJobData {
  sessionId: string;
  userId: string;
}

export interface IngestNewsJobData {
  source?: string;
  category?: string;
}

// ── Helper: add jobs ─────────────────────────────────────────
export const addEvaluateAnswerJob = (data: EvaluateAnswerJobData, priority = 10) =>
  evaluateAnswerQueue.add('evaluate', data, { priority });

export const addGenerateQuestionJob = (data: GenerateQuestionJobData) =>
  generateQuestionQueue.add('generate', data);

export const addGenerateScorecardJob = (data: GenerateScorecardJobData) =>
  generateScorecardQueue.add('scorecard', data);

export const addRecommendRolesJob = (data: RecommendRolesJobData) =>
  recommendRolesQueue.add('recommend', data);

export const addIngestNewsJob = (data: IngestNewsJobData = {}) =>
  ingestNewsQueue.add('ingest', data, {
    repeat: { every: env.NEWS_INGEST_INTERVAL_MS ?? 10 * 60 * 1000 }
  });

// ── Graceful close ───────────────────────────────────────────
// Note: We close queues but NOT the shared connection here —
// closeBullConnection() in bullmq-connection.ts handles that
// and must be called AFTER all queues and workers are closed.
export const closeAllQueues = async () => {
  await Promise.allSettled([
    evaluateAnswerQueue.close(),
    generateQuestionQueue.close(),
    generateScorecardQueue.close(),
    recommendRolesQueue.close(),
    ingestNewsQueue.close(),
  ]);
  logger.info('All queues closed');
};