// ============================================================
// NxtStep — JWT Utilities
// ============================================================

import jwt, { SignOptions } from 'jsonwebtoken';
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
  iat?: number;
  exp?: number;
}

export const signToken = (
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn?: string,
): string => {
  const options: SignOptions = {
    expiresIn: (expiresIn ?? env.JWT_EXPIRES_IN) as SignOptions['expiresIn'],
    issuer: 'nxtstep.app',
    audience: 'nxtstep-client',
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const signEphemeralToken = (payload: Omit<EphemeralTokenPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EPHEMERAL_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'nxtstep.app',
    audience: 'nxtstep-interview',
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyToken = <T>(token: string, audience?: string): T => {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'nxtstep.app',
    audience: audience ?? ['nxtstep-client', 'nxtstep-interview'],
  }) as T;
};

export const decodeToken = <T>(token: string): T | null => {
  return jwt.decode(token) as T | null;
};

export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken<{ exp?: number }>(token);
  if (!decoded?.exp) return true;
  return decoded.exp * 1000 < Date.now();
};
