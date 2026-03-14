// ============================================================
// NxtStep — Recommendations Worker (BullMQ)
// Consumes jobs from the 'compute-recommendations' queue.
// Triggered automatically after scorecardWorker completes.
//
// Job payload: { sessionId: string, userId: string, scorecardId: string }
// ============================================================

import { Worker, Job } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { computeRecommendations } from '../services/recommendationService';

export interface ComputeRecommendationsJob {
  sessionId:   string;
  userId:      string;
  scorecardId: string;
}

const connection = { url: env.REDIS_URL };

export const recommendationsWorker = new Worker<ComputeRecommendationsJob>(
  'compute-recommendations',
  async (job: Job<ComputeRecommendationsJob>) => {
    const { sessionId, userId } = job.data;

    logger.info(
      `[RecommendWorker] Computing recommendations: ` +
      `session=${sessionId} user=${userId} job=${job.id}`,
    );

    await computeRecommendations(sessionId, userId);

    logger.info(
      `[RecommendWorker] Done: session=${sessionId} job=${job.id}`,
    );

    return { done: true };
  },
  {
    connection,
    concurrency: 3,
    limiter: {
      max:      10,  // Max 10 jobs per window
      duration: 60_000,
    },
  },
);

recommendationsWorker.on('failed', (job, err) => {
  logger.error(
    `[RecommendWorker] Job ${job?.id} failed: ${err.message}`,
    { sessionId: job?.data?.sessionId, error: err.stack },
  );
});

recommendationsWorker.on('completed', (job) => {
  const elapsed = (job.processedOn ?? 0) - job.timestamp;
  logger.debug(
    `[RecommendWorker] Job ${job.id} completed in ${elapsed}ms`,
  );
});

recommendationsWorker.on('error', (err) => {
  logger.error(`[RecommendWorker] Worker error: ${err.message}`);
});