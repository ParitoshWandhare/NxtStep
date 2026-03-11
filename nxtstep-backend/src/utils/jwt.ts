import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface EphemeralTokenPayload {
  sessionId: string;
  userId: string;
  type: 'interview_session';
}

export const signToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const signEphemeralToken = (payload: EphemeralTokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EPHEMERAL_EXPIRES_IN,
  } as jwt.SignOptions);
};

export const verifyToken = <T>(token: string): T => {
  return jwt.verify(token, env.JWT_SECRET) as T;
};