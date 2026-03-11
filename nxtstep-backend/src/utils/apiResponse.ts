import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: Record<string, unknown>
): Response => {
  const response: ApiResponse<T> = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Created'): Response =>
  sendSuccess(res, data, message, 201);

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  error?: string
): Response => {
  return res.status(statusCode).json({ success: false, message, error });
};

export const sendBadRequest = (res: Response, message: string): Response =>
  sendError(res, message, 400);

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response =>
  sendError(res, message, 401);

export const sendForbidden = (res: Response, message = 'Forbidden'): Response =>
  sendError(res, message, 403);

export const sendNotFound = (res: Response, message = 'Not found'): Response =>
  sendError(res, message, 404);