import crypto from 'node:crypto';
import { getDbClient } from '../db';
import { getUtcTimestamp } from '@frostledger/shared';

export async function writeAuditLog(
  actor: string,
  action: 'profile_change' | 'profile_version_increment' | 'shipment_creation' | 'key_revocation' | 'report_export' | string,
  target: string
): Promise<string> {
  const db = await getDbClient();
  const logId = `log-${crypto.randomUUID()}`;
  const timestamp = getUtcTimestamp();

  await db.query(
    `INSERT INTO audit_log (log_id, actor, action, target, timestamp)
     VALUES ($1, $2, $3, $4, $5)`,
    [logId, actor, action, target, timestamp]
  );

  return logId;
}
