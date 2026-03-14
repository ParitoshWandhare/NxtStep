import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendBadRequest } from '../utils/apiResponse';

type RequestTarget = 'body' | 'query' | 'params';

export const validate = (
  schema: ZodSchema,
  target: RequestTarget = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));

      sendBadRequest(
        res,
        `Validation failed: ${errors.map((e) => e.message).join('; ')}`,
        errors,
      );
      return;
    }

    // Replace with parsed/transformed data
    (req as any)[target] = result.data;
    next();
  };
};