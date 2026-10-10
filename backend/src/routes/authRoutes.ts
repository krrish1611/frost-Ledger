import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { getDbClient } from '../db';
import {
  RegisterInputSchema,
  LoginInputSchema,
  createErrorResponse,
  getUtcTimestamp,
} from '@frostledger/shared';
import { validateBody } from '../middleware/validate';
import { authenticateJwt, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'frostledger_default_development_secret_32_chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

router.post(
  '/register',
  validateBody(RegisterInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, role, org_id } = req.body;
    const db = await getDbClient();

    // Check if user already exists
    const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json(createErrorResponse('EMAIL_ALREADY_EXISTS', 'Email is already registered'));
    }

    const userId = `usr-${crypto.randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = getUtcTimestamp();

    await db.query(
      `INSERT INTO users (user_id, org_id, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, org_id, email, passwordHash, role, createdAt]
    );

    return res.status(201).json({
      user: {
        user_id: userId,
        org_id,
        email,
        role,
        created_at: createdAt,
      },
    });
  })
);

router.post(
  '/login',
  validateBody(LoginInputSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const db = await getDbClient();

    const userRes = await db.query(
      'SELECT user_id, org_id, email, password_hash, role, created_at FROM users WHERE email = $1',
      [email]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json(createErrorResponse('INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json(createErrorResponse('INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        org_id: user.org_id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    return res.json({
      token,
      user: {
        user_id: user.user_id,
        org_id: user.org_id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  })
);

router.get('/me', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

export default router;
