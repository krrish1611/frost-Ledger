import { Request, Response, NextFunction } from 'express';
import { createErrorResponse } from '@frostledger/shared';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const clientRecords = new Map<string, RateLimitRecord>();

export function rateLimiter(maxRequests: number = 200, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, do not throttle
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const key = req.ip || req.headers['x-forwarded-for']?.toString() || 'anonymous';
    const now = Date.now();
    const record = clientRecords.get(key);

    if (!record || now > record.resetAt) {
      clientRecords.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json(
        createErrorResponse('RATE_LIMIT_EXCEEDED', `Rate limit exceeded. Try again in ${Math.ceil((record.resetAt - now) / 1000)} seconds.`)
      );
    }

    record.count += 1;
    return next();
  };
}
