import { Queue } from 'bullmq';
import { env } from '../config/env';

export const bullRedisConnection = {
  url: env.REDIS_URL,
};

const connection = {
  url: env.REDIS_URL,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

// Interview engine queues
export const evaluateAnswerQueue = new Queue('evaluate-answer', {
  connection,
  defaultJobOptions,
});

export const generateQuestionQueue = new Queue('generate-question', {
  connection,
  defaultJobOptions,
});

export const generateFollowUpQueue = new Queue('generate-followup', {
  connection,
  defaultJobOptions,
});

export const computeScorecardQueue = new Queue('compute-scorecard', {
  connection,
  defaultJobOptions,
});

export const computeRecommendationsQueue = new Queue('compute-recommendations', {
  connection,
  defaultJobOptions,
});

// News queue
export const ingestNewsQueue = new Queue('ingest-news', {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
});

// Job data types
export interface EvaluateAnswerJob {
  sessionId: string;
  questionId: string;
  answerText: string;
  questionText: string;
  expectedKeywords: string[];
  role: string;
  level: string;
}

export interface GenerateQuestionJob {
  sessionId: string;
  role: string;
  level: string;
  topic: string;
  previousQuestions: string[];
}

export interface GenerateFollowUpJob {
  sessionId: string;
  questionId: string;
  originalQuestion: string;
  candidateAnswer: string;
  missingKeywords: string[];
  weaknesses: string[];
}

export interface ComputeScorecardJob {
  sessionId: string;
  userId: string;
}

export interface ComputeRecommendationsJob {
  sessionId: string;
  userId: string;
  scorecardId: string;
}