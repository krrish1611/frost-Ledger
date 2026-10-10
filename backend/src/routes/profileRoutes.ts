import { Router, Response } from 'express';
import { getDbClient } from '../db';
import {
  CreateProfileInputSchema,
  createErrorResponse,
  getUtcTimestamp,
} from '@frostledger/shared';
import { validateBody } from '../middleware/validate';
import { authenticateJwt, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// GET /profiles - List profiles (latest version by default)
router.get(
  '/',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDbClient();
    const profileIdQuery = req.query.profile_id as string | undefined;

    let querySql = `
      SELECT p.profile_id, p.version, p.parameters, p.created_by, p.created_at
      FROM profiles p
    `;
    const params: any[] = [];

    if (profileIdQuery) {
      querySql += ' WHERE p.profile_id = $1 ORDER BY p.version DESC';
      params.push(profileIdQuery);
    } else {
      // Return the latest version of each profile
      querySql += `
        INNER JOIN (
          SELECT profile_id, MAX(version) as max_v
          FROM profiles
          GROUP BY profile_id
        ) latest ON p.profile_id = latest.profile_id AND p.version = latest.max_v
        ORDER BY p.profile_id ASC
      `;
    }

    const result = await db.query(querySql, params);
    return res.json({ profiles: result.rows });
  })
);

// GET /profiles/:id - Get all versions of a specific profile
router.get(
  '/:id',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = await getDbClient();

    const result = await db.query(
      `SELECT profile_id, version, parameters, created_by, created_at
       FROM profiles
       WHERE profile_id = $1
       ORDER BY version DESC`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', `Profile '${id}' was not found`));
    }

    return res.json({
      profile_id: id,
      latest: result.rows[0],
      versions: result.rows,
    });
  })
);

// POST /profiles - Create profile or append a new immutable version
router.post(
  '/',
  authenticateJwt,
  requireRole('operator', 'admin'),
  validateBody(CreateProfileInputSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { profile_id, parameters } = req.body;
    const actor = req.user?.email || 'anonymous';
    const db = await getDbClient();

    // Query highest version currently recorded for this profile_id
    const versionRes = await db.query(
      'SELECT COALESCE(MAX(version), 0) AS max_version FROM profiles WHERE profile_id = $1',
      [profile_id]
    );
    const currentMax = Number(versionRes.rows[0].max_version);
    const newVersion = currentMax + 1;
    const createdAt = getUtcTimestamp();

    await db.query(
      `INSERT INTO profiles (profile_id, version, parameters, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [profile_id, newVersion, JSON.stringify(parameters), actor, createdAt]
    );

    // Write audit log entry for profile change
    await writeAuditLog(actor, 'profile_change', `profile:${profile_id}:v${newVersion}`);

    return res.status(201).json({
      profile: {
        profile_id,
        version: newVersion,
        parameters,
        created_by: actor,
        created_at: createdAt,
      },
    });
  })
);

export default router;
