import { Router, Response } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db';
import { createErrorResponse } from '@frostledger/shared';
import { validateBody } from '../middleware/validate';
import { authenticateJwt, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { writeAuditLog } from '../services/auditService';

const router = Router();

export const AcknowledgeAlertSchema = z.object({
  note: z.string().min(1, 'A note is required for acknowledging an alert'),
});

// GET /alerts - List alerts
router.get(
  '/',
  authenticateJwt,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDbClient();
    const shipmentId = req.query.shipment_id as string | undefined;
    const source = req.query.source as string | undefined;

    let querySql = `
      SELECT alert_id, shipment_id, type, severity, source, acknowledged_by, note, created_at
      FROM alerts
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (shipmentId) {
      params.push(shipmentId);
      conditions.push(`shipment_id = $${params.length}`);
    }

    if (source) {
      params.push(source);
      conditions.push(`source = $${params.length}`);
    }

    if (conditions.length > 0) {
      querySql += ' WHERE ' + conditions.join(' AND ');
    }

    querySql += ' ORDER BY created_at DESC';

    const result = await db.query(querySql, params);
    return res.json({ alerts: result.rows });
  })
);

// POST /alerts/:id/acknowledge - Acknowledge alert with note and audit log entry
router.post(
  '/:id/acknowledge',
  authenticateJwt,
  validateBody(AcknowledgeAlertSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { note } = req.body;
    const actor = req.user?.email || 'anonymous';
    const db = await getDbClient();

    const alertRes = await db.query('SELECT alert_id, acknowledged_by FROM alerts WHERE alert_id = $1', [id]);
    if (alertRes.rowCount === 0) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', `Alert '${id}' not found`));
    }

    // Update alert acknowledgement
    await db.query(
      'UPDATE alerts SET acknowledged_by = $1, note = $2 WHERE alert_id = $3',
      [actor, note, id]
    );

    // Record action in immutable audit log
    await writeAuditLog(actor, 'alert_acknowledgement', `alert:${id}`);

    return res.json({
      message: `Alert '${id}' acknowledged successfully`,
      alert_id: id,
      acknowledged_by: actor,
      note,
    });
  })
);

export default router;
