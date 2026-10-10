import crypto from 'node:crypto';
import { getDbClient } from '../db';
import { getUtcTimestamp } from '@frostledger/shared';

export interface AlertRecord {
  alert_id: string;
  shipment_id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  source: 'deterministic' | 'security';
  acknowledged_by?: string | null;
  note?: string | null;
  created_at: string;
}

export async function createAlert(params: {
  shipment_id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  source: 'deterministic' | 'security';
  note?: string | null;
}): Promise<AlertRecord> {
  const db = await getDbClient();
  const alert_id = `alt-${crypto.randomUUID()}`;
  const created_at = getUtcTimestamp();

  await db.query(
    `INSERT INTO alerts (alert_id, shipment_id, type, severity, source, acknowledged_by, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      alert_id,
      params.shipment_id,
      params.type,
      params.severity,
      params.source,
      null,
      params.note || null,
      created_at,
    ]
  );

  return {
    alert_id,
    shipment_id: params.shipment_id,
    type: params.type,
    severity: params.severity,
    source: params.source,
    acknowledged_by: null,
    note: params.note || null,
    created_at,
  };
}

export async function createSecurityAlert(
  shipment_id: string,
  type: string,
  severity: 'warning' | 'critical' = 'critical',
  note?: string
): Promise<AlertRecord> {
  return createAlert({
    shipment_id,
    type,
    severity,
    source: 'security',
    note,
  });
}
