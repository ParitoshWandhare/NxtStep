import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: number | string;
  errors?: unknown[];
}

// ── Central error handler ─────────────────────────────────────

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = err.statusCode ?? 500;
  let message = err.message ?? 'Internal server error';
  let errors: unknown[] | undefined;

  // ── Mongoose validation error ────────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => {
      const validatorError = e as mongoose.Error.ValidatorError;
      return {
        field: validatorError.path,
        message: validatorError.message,
      };
    });
  }

  // ── Mongoose duplicate key error ─────────────────────────────
  else if (err.code === 11000) {
    statusCode = 409;
    const field = extractDuplicateField(err.message);
    message = `${field} already exists`;
  }

  // ── Mongoose cast error (invalid ObjectId) ───────────────────
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ── Zod validation error ─────────────────────────────────────
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // ── JWT errors ───────────────────────────────────────────────
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Token not yet valid';
  }

  // ── Log server errors ─────────────────────────────────────────
  if (statusCode >= 500) {
    logger.error(
      {
        err,
        method: req.method,
        url: req.url,
        statusCode,
        userId: (req as { user?: { userId?: string } }).user?.userId,
      },
      'Server error',
    );
  }

  const response: Record<string, unknown> = {
    success: false,
    message,
    ...(errors && { errors }),
  };

  // Include stack trace in development only
  if (env.NODE_ENV === 'development' && statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// ── 404 handler ───────────────────────────────────────────────

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};

// ── Async handler wrapper (eliminates try/catch boilerplate) ──

export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>,
) => {
  return (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ── Create operational error ──────────────────────────────────

export const createError = (
  message: string,
  statusCode: number,
): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

// ── Helpers ───────────────────────────────────────────────────

const extractDuplicateField = (message: string): string => {
  const match = message.match(/index: (\w+)_/);
  return match ? match[1] : 'Field';
};