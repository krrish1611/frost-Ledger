import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createErrorResponse } from '@frostledger/shared';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errorDetails = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        return res.status(400).json(createErrorResponse('VALIDATION_ERROR', errorDetails));
      }
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid request body format'));
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      return next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const errorDetails = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        return res.status(400).json(createErrorResponse('VALIDATION_ERROR', errorDetails));
      }
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters'));
    }
  };
}
