import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { sendUnauthorized } from '../utils/apiResponse';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendUnauthorized(res, 'No token provided');
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken<JwtPayload>(token);
    req.user = payload;
    next();
  } catch {
    sendUnauthorized(res, 'Invalid or expired token');
  }
};