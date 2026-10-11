import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, JwtTokenPayload, createErrorResponse } from '@frostledger/shared';

export interface AuthenticatedRequest extends Request {
  user?: JwtTokenPayload;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'frostledger_default_development_secret_32_chars';
}

export function authenticateJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Missing or malformed Authorization header'));
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtTokenPayload;
    req.user = decoded;
    return next();
  } catch (err: any) {
    return res.status(401).json(createErrorResponse('UNAUTHORIZED', `Invalid or expired token: ${err.message}`));
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(
        createErrorResponse(
          'FORBIDDEN',
          `Access forbidden: required role [${allowedRoles.join(', ')}], current role is '${req.user.role}'`
        )
      );
    }

    return next();
  };
}

export const requireAdmin = requireRole('admin');

export function optionalAuthenticateJwt(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as JwtTokenPayload;
      req.user = decoded;
    } catch {
      // Ignore invalid token in optional mode
    }
  }
  return next();
}

