import { Router, Response } from 'express';
import { getDbClient } from '../db';
import { createErrorResponse, getUtcTimestamp } from '@frostledger/shared';
import { authenticateJwt, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// All /admin/* routes require valid JWT and admin role
router.use(authenticateJwt);
router.use(requireAdmin);

// GET /admin/audit-log - View system audit trail
router.get(
  '/audit-log',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await getDbClient();
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const result = await db.query(
      'SELECT log_id, actor, action, target, timestamp FROM audit_log ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );

    return res.json({ audit_logs: result.rows });
  })
);

// POST /admin/devices/:id/revoke - Revoke a device key
router.post(
  '/devices/:id/revoke',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const actor = req.user?.email || 'admin';
    const db = await getDbClient();

    const deviceRes = await db.query('SELECT device_id, status FROM devices WHERE device_id = $1', [id]);
    if (deviceRes.rowCount === 0) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', `Device '${id}' not found`));
    }

    const revokedAt = getUtcTimestamp();
    await db.query('UPDATE devices SET status = $1, revoked_at = $2 WHERE device_id = $3', ['revoked', revokedAt, id]);

    // Log key revocation in audit log
    await writeAuditLog(actor, 'key_revocation', `device:${id}`);

    return res.json({
      message: `Device '${id}' has been revoked successfully`,
      device_id: id,
      status: 'revoked',
      revoked_at: revokedAt,
    });
  })
);

// POST /admin/reports/export - Trigger audit report export
router.post(
  '/reports/export',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const actor = req.user?.email || 'admin';
    const reportType = req.body?.report_type || 'full_audit';

    await writeAuditLog(actor, 'report_export', `report:${reportType}`);

    return res.json({
      message: 'Report export initiated and logged to audit trail',
      report_type: reportType,
      exported_at: getUtcTimestamp(),
    });
  })
);

export default router;
