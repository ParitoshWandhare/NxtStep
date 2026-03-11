// ============================================================
// NxtStep Interview Engine — Queue Definitions (BullMQ)
// All AI-heavy and async tasks are offloaded to queues.
// ============================================================

import { Queue } from 'bullmq';
import {
  ComputeScorecardJob,
  EvaluateAnswerJob,
  GenerateFollowUpJob,
  GenerateQuestionJob,
} from '../types/interview.types';

// ─── Redis connection config ──────────────────────────────────

export const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
};

// ─── Queue names ──────────────────────────────────────────────

export const QUEUE_NAMES = {
  EVALUATE_ANSWER:    'evaluateAnswer',
  GENERATE_QUESTION:  'generateQuestion',
  GENERATE_FOLLOW_UP: 'generateFollowUp',
  COMPUTE_SCORECARD:  'computeScorecard',
} as const;

// ─── Queue instances ──────────────────────────────────────────

export const evaluateAnswerQueue = new Queue<EvaluateAnswerJob>(
  QUEUE_NAMES.EVALUATE_ANSWER,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts:    3,
      backoff:     { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50 },
    },
  }
);

export const generateQuestionQueue = new Queue<GenerateQuestionJob>(
  QUEUE_NAMES.GENERATE_QUESTION,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff:  { type: 'fixed', delay: 500 },
      removeOnComplete: { count: 50 },
    },
  }
);

export const generateFollowUpQueue = new Queue<GenerateFollowUpJob>(
  QUEUE_NAMES.GENERATE_FOLLOW_UP,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff:  { type: 'fixed', delay: 500 },
      removeOnComplete: { count: 50 },
    },
  }
);

export const computeScorecardQueue = new Queue<ComputeScorecardJob>(
  QUEUE_NAMES.COMPUTE_SCORECARD,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff:  { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 20 },
    },
  }
);

// ─── Enqueue helpers ──────────────────────────────────────────

export async function enqueueEvaluateAnswer(job: EvaluateAnswerJob): Promise<string> {
  const added = await evaluateAnswerQueue.add(
    `eval:${job.sessionId}:${job.questionId}`,
    job,
    { priority: 1 }
  );
  console.log(`[Queue] Enqueued evaluateAnswer job ${added.id} for session ${job.sessionId}`);
  return added.id!;
}

export async function enqueueGenerateQuestion(job: GenerateQuestionJob): Promise<string> {
  const added = await generateQuestionQueue.add(
    `genQ:${job.sessionId}`,
    job,
  );
  console.log(`[Queue] Enqueued generateQuestion job ${added.id}`);
  return added.id!;
}

export async function enqueueGenerateFollowUp(job: GenerateFollowUpJob): Promise<string> {
  const added = await generateFollowUpQueue.add(
    `fu:${job.sessionId}:${job.questionId}`,
    job,
  );
  console.log(`[Queue] Enqueued generateFollowUp job ${added.id}`);
  return added.id!;
}

export async function enqueueComputeScorecard(job: ComputeScorecardJob): Promise<string> {
  const added = await computeScorecardQueue.add(
    `scorecard:${job.sessionId}`,
    job,
  );
  console.log(`[Queue] Enqueued computeScorecard job ${added.id}`);
  return added.id!;
}

// ─── Queue health check ───────────────────────────────────────

export async function getQueueMetrics() {
  const [evalWaiting, evalActive, evalFailed] = await Promise.all([
    evaluateAnswerQueue.getWaitingCount(),
    evaluateAnswerQueue.getActiveCount(),
    evaluateAnswerQueue.getFailedCount(),
  ]);

  return {
    evaluateAnswer: { waiting: evalWaiting, active: evalActive, failed: evalFailed },
  };
}
