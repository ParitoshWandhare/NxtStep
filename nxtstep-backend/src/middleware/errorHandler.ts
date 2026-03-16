// ============================================================
// NxtStep — Error Handler Middleware
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiResponse';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export const createError = (message: string, statusCode = 500, code?: string): AppError => {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.isOperational = true;
  return err;
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
};

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode ?? 500;
  const isOperational = err.isOperational ?? false;

  if (statusCode >= 500) {
    logger.error({ err, path: req.path, method: req.method, statusCode }, 'Unhandled error');
  } else {
    logger.warn({ code: err.code, message: err.message, path: req.path }, 'Operational error');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: err.message },
    });
    return;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0] ?? 'field';
    res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_KEY', message: `${field} already exists` },
    });
    return;
  }

  // Mongoose cast error (invalid ObjectId etc)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid ID format' },
    });
    return;
  }

  const message =
    isOperational || process.env.NODE_ENV !== 'production'
      ? err.message
      : 'An unexpected error occurred';

  sendError(res, message, statusCode, err.code ? [err.code] : undefined);
};