import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { sendUnauthorized } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    sendUnauthorized(res, 'No authentication token provided');
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (!token) {
    sendUnauthorized(res, 'Empty authentication token');
    return;
  }

  try {
    const payload = verifyToken<JwtPayload>(token);

    // Validate required fields in payload
    if (!payload.userId || !payload.email) {
      sendUnauthorized(res, 'Invalid token payload');
      return;
    }

    req.user = payload;
    next();
  } catch (err) {
    const error = err as Error;

    if (error.name === 'TokenExpiredError') {
      sendUnauthorized(res, 'Authentication token expired');
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      sendUnauthorized(res, 'Invalid authentication token');
      return;
    }

    logger.warn({ err: error, path: req.path }, 'Unexpected token verification error');
    sendUnauthorized(res, 'Authentication failed');
  }
};

// ── Optional auth (enriches req.user if token present, doesn't block) ──

export const optionalAuthenticate = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken<JwtPayload>(token);
    req.user = payload;
  } catch {
    // Silently ignore invalid tokens for optional auth
  }

  next();
};