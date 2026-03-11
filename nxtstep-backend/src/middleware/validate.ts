import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendBadRequest } from '../utils/apiResponse';

export const validate = (schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = (result.error as ZodError).errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      sendBadRequest(res, errors);
      return;
    }
    req[target] = result.data;
    next();
  };
};