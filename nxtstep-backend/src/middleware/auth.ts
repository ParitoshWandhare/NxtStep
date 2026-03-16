// ============================================================
// NxtStep — Auth Middleware
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { sendUnauthorized } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendUnauthorized(res, 'No authentication token provided');
    return;
  }

  const token = authHeader.substring(7);
  if (!token) {
    sendUnauthorized(res, 'Empty authentication token');
    return;
  }

  try {
    const payload = verifyToken<JwtPayload>(token);
    if (!payload.userId || !payload.email) {
      sendUnauthorized(res, 'Invalid token payload');
      return;
    }
    req.user = payload;
    next();
  } catch (err) {
    const error = err as Error;
    if (error.name === 'TokenExpiredError') { sendUnauthorized(res, 'Token expired'); return; }
    if (error.name === 'JsonWebTokenError') { sendUnauthorized(res, 'Invalid token'); return; }
    logger.warn({ err: error, path: req.path }, 'Token verification error');
    sendUnauthorized(res, 'Authentication failed');
  }
};

export const optionalAuthenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  const token = authHeader.substring(7);
  try {
    req.user = verifyToken<JwtPayload>(token);
  } catch { /* silent */ }
  next();
};
