// ============================================================
// NxtStep — API Response Helpers
// ============================================================

import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response => {
  const response: ApiResponse<T> = { success: true, message, data };
  if (meta && Object.keys(meta).length > 0) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Created successfully'): Response =>
  sendSuccess(res, data, message, 201);

export const sendNoContent = (res: Response): Response => res.status(204).send();

export const sendError = (res: Response, message: string, statusCode = 500, errors?: unknown[]): Response => {
  const response: Record<string, unknown> = { success: false, message };
  if (errors?.length) response.errors = errors;
  return res.status(statusCode).json(response);
};

export const sendBadRequest = (res: Response, message: string, errors?: unknown[]): Response =>
  sendError(res, message, 400, errors);

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response =>
  sendError(res, message, 401);

export const sendForbidden = (res: Response, message = 'Forbidden'): Response =>
  sendError(res, message, 403);

export const sendNotFound = (res: Response, message = 'Resource not found'): Response =>
  sendError(res, message, 404);

export const sendConflict = (res: Response, message: string): Response =>
  sendError(res, message, 409);

export const sendTooManyRequests = (res: Response, message = 'Too many requests'): Response =>
  sendError(res, message, 429);
