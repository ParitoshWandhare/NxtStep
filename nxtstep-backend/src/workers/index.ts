// Worker process — run separately from the main API server
// Usage: npm run worker

import '../config/env'; // Validate env first
import { connectDB } from '../config/database';
import { connectRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { ingestNewsQueue } from '../queues';
import { Worker, Job } from 'bullmq';
import { ingestNews } from '../services/newsService';
import { env } from '../config/env';
import cron from 'node-cron';

const start = async () => {
  await connectDB();
  await connectRedis();

  // Import workers (this registers them)
  await import('./interviewWorker');

  // News ingestion worker
  const newsWorker = new Worker(
    'ingest-news',
    async (_job: Job) => {
      logger.info('Running news ingestion job...');
      const result = await ingestNews();
      logger.info(`News ingestion done: ${JSON.stringify(result)}`);
      return result;
    },
    { connection: { url: env.REDIS_URL }, concurrency: 1 }
  );

  newsWorker.on('failed', (job, err) => {
    logger.error(`News worker job failed: ${err.message}`);
  });

  // Schedule recurring news ingestion
  // Tech/AI every 10 minutes, others every 30 minutes
  cron.schedule('*/10 * * * *', async () => {
    await ingestNewsQueue.add('ingest-tech-ai', {});
  });

  // Initial ingestion on startup
  await ingestNewsQueue.add('ingest-startup', {});

  logger.info('✅ All workers started');
};

start().catch((err) => {
  logger.error('Worker startup failed:', err);
  process.exit(1);
});