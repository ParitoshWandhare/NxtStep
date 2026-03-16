// ============================================================
// NxtStep — Logger
// Pino-based structured logging with pretty-print in dev.
// ============================================================

import pino, { Logger } from 'pino';
import { env } from '../config/env';

const isDev = env.NODE_ENV !== 'production';
const isTest = env.NODE_ENV === 'test';

const transport = isDev && !isTest
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        errorLikeObjectKeys: ['err', 'error'],
      },
    }
  : undefined;

export const logger: Logger = pino(
  {
    level: isTest ? 'silent' : env.LOG_LEVEL,
    base: { service: 'nxtstep-api', env: env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'body.password',
        'body.newPassword',
        '*.passwordHash',
        '*.passwordResetToken',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
  },
  transport ? pino.transport(transport) : undefined,
);

export const logAICall = (
  model: string,
  promptTokens: number,
  completionTokens: number,
  latencyMs: number,
  purpose: string,
) => {
  logger.info({ model, promptTokens, completionTokens, latencyMs, purpose }, 'AI API call');
};

export const logWorkerJob = (
  queue: string,
  jobId: string,
  status: 'started' | 'completed' | 'failed',
  durationMs?: number,
  error?: string,
) => {
  const level = status === 'failed' ? 'error' : 'info';
  logger[level]({ queue, jobId, status, durationMs, error }, `Worker job ${status}`);
};
