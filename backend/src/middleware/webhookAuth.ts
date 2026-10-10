import { Request, Response, NextFunction } from 'express';
import { createErrorResponse } from '@frostledger/shared';

export function authenticateWebhook(req: Request, res: Response, next: NextFunction) {
  const secretHeader = req.headers['x-webhook-secret'] as string | undefined;
  const authHeader = req.headers.authorization;
  const configuredSecret = process.env.WEBHOOK_SECRET || 'frostledger_default_webhook_secret';

  let incomingSecret = secretHeader;
  if (!incomingSecret && authHeader && authHeader.startsWith('Bearer ')) {
    incomingSecret = authHeader.substring(7);
  }

  if (!incomingSecret || incomingSecret !== configuredSecret) {
    return res
      .status(401)
      .json(createErrorResponse('UNAUTHORIZED_WEBHOOK', 'Invalid or missing webhook secret header'));
  }

  return next();
}
