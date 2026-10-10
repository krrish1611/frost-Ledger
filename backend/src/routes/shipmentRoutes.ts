import { Router, Response } from 'express';
import { getDbClient } from '../db';
import {
  CreateShipmentInputSchema,
  computeCanonicalHash,
  createErrorResponse,
  getUtcTimestamp,
} from '@frostledger/shared';
import { validateBody } from '../middleware/validate';
import { authenticateJwt, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// GET /shipments - List all shipments
router.get(
  '/',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDbClient();
    const result = await db.query(`
      SELECT s.shipment_id, s.device_id, s.profile_id, s.profile_version, s.profile_hash,
             s.status, s.start_time, s.end_time, s.ai_enabled, s.ai_email_enabled
      FROM shipments s
      ORDER BY s.start_time DESC
    `);

    return res.json({ shipments: result.rows });
  })
);

// GET /shipments/:id - Get shipment detail
router.get(
  '/:id',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = await getDbClient();

    const shipmentRes = await db.query(
      `SELECT shipment_id, device_id, profile_id, profile_version, profile_hash,
              status, start_time, end_time, ai_enabled, ai_email_enabled
       FROM shipments
       WHERE shipment_id = $1`,
      [id]
    );

    if (shipmentRes.rowCount === 0) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', `Shipment '${id}' was not found`));
    }

    return res.json({ shipment: shipmentRes.rows[0] });
  })
);

// POST /shipments - Create a new shipment and freeze profile version & hash
router.post(
  '/',
  authenticateJwt,
  requireRole('operator', 'admin'),
  validateBody(CreateShipmentInputSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { shipment_id, device_id, profile_id, profile_version, ai_enabled, ai_email_enabled } = req.body;
    const actor = req.user?.email || 'anonymous';
    const db = await getDbClient();

    // 1. Check if shipment_id already exists
    const existingShipment = await db.query('SELECT 1 FROM shipments WHERE shipment_id = $1', [shipment_id]);
    if (existingShipment.rowCount > 0) {
      return res.status(409).json(createErrorResponse('CONFLICT', `Shipment '${shipment_id}' already exists`));
    }

    // 2. Validate device existence and status
    const deviceRes = await db.query('SELECT device_id, status FROM devices WHERE device_id = $1', [device_id]);
    if (deviceRes.rowCount === 0) {
      return res.status(400).json(createErrorResponse('INVALID_DEVICE', `Device '${device_id}' does not exist`));
    }
    if (deviceRes.rows[0].status === 'revoked') {
      return res.status(400).json(createErrorResponse('INVALID_DEVICE', `Device '${device_id}' has been revoked`));
    }

    // 3. Resolve profile version
    let profileQuery = 'SELECT profile_id, version, parameters FROM profiles WHERE profile_id = $1';
    const profileParams: any[] = [profile_id];

    if (profile_version) {
      profileQuery += ' AND version = $2';
      profileParams.push(profile_version);
    } else {
      profileQuery += ' ORDER BY version DESC LIMIT 1';
    }

    const profileRes = await db.query(profileQuery, profileParams);
    if (profileRes.rowCount === 0) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            'PROFILE_NOT_FOUND',
            profile_version
              ? `Profile '${profile_id}' version ${profile_version} was not found`
              : `Profile '${profile_id}' was not found`
          )
        );
    }

    const frozenProfile = profileRes.rows[0];
    const resolvedVersion = Number(frozenProfile.version);

    // 4. Compute canonical hash over the profile parameters
    const parsedParameters =
      typeof frozenProfile.parameters === 'string'
        ? JSON.parse(frozenProfile.parameters)
        : frozenProfile.parameters;
    const profileHash = computeCanonicalHash(parsedParameters);

    // 5. Insert shipment record
    const startTime = getUtcTimestamp();
    await db.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash,
        status, start_time, end_time, ai_enabled, ai_email_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        shipment_id,
        device_id,
        profile_id,
        resolvedVersion,
        profileHash,
        'created',
        startTime,
        null,
        ai_enabled,
        ai_email_enabled,
      ]
    );

    // 6. Write sensitive audit log entry
    await writeAuditLog(actor, 'shipment_creation', `shipment:${shipment_id}`);

    return res.status(201).json({
      shipment: {
        shipment_id,
        device_id,
        profile_id,
        profile_version: resolvedVersion,
        profile_hash: profileHash,
        status: 'created',
        start_time: startTime,
        end_time: null,
        ai_enabled,
        ai_email_enabled,
      },
    });
  })
);

export default router;
