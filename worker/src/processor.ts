import { Pool } from 'pg';
import {
  ProfileParameters,
  calculateRemainingShelfLife,
  checkThresholds,
  SensorReading,
  TimedReading,
  getUtcTimestamp,
} from '@frostledger/shared';
import crypto from 'node:crypto';

export interface WorkerJobPayload {
  batch_id: string;
  shipment_id: string;
  device_id: string;
  sequence_no: number;
}

export async function processBatchInWorker(
  db: Pool,
  job: WorkerJobPayload
): Promise<{ mkt: number; remainingLife: number; alertCount: number }> {
  const { batch_id, shipment_id, sequence_no } = job;

  // 1. Fetch shipment with frozen profile
  const shipmentRes = await db.query(
    `SELECT s.shipment_id, p.parameters
     FROM shipments s
     JOIN profiles p ON s.profile_id = p.profile_id AND s.profile_version = p.version
     WHERE s.shipment_id = $1`,
    [shipment_id]
  );

  if (shipmentRes.rowCount === 0) {
    throw new Error(`Shipment ${shipment_id} or profile not found`);
  }

  const rawParams = shipmentRes.rows[0].parameters;
  const profile: ProfileParameters =
    typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams;

  // 2. Fetch history up to current sequence
  const historyRes = await db.query(
    `SELECT payload FROM batches
     WHERE shipment_id = $1 AND sequence_no <= $2
     ORDER BY sequence_no ASC`,
    [shipment_id, sequence_no]
  );

  const timedReadings: TimedReading[] = [];
  let currentReadings: SensorReading[] = [];

  for (let i = 0; i < historyRes.rows.length; i++) {
    const payload =
      typeof historyRes.rows[i].payload === 'string'
        ? JSON.parse(historyRes.rows[i].payload)
        : historyRes.rows[i].payload;
    if (payload.readings) {
      for (const r of payload.readings) {
        timedReadings.push({ timestamp: r.timestamp, temperature: r.temperature });
      }
      if (i === historyRes.rows.length - 1) {
        currentReadings = payload.readings;
      }
    }
  }

  // 3. Compute pure MKT and shelf life
  const shelfLifeResult = calculateRemainingShelfLife(timedReadings, profile);

  // 4. Store step in shelf_life_trail for audit
  await db.query(
    `INSERT INTO shelf_life_trail (shipment_id, batch_id, mkt, consumed_fraction, remaining_life, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (shipment_id, batch_id)
     DO UPDATE SET
       mkt = EXCLUDED.mkt,
       consumed_fraction = EXCLUDED.consumed_fraction,
       remaining_life = EXCLUDED.remaining_life`,
    [
      shipment_id,
      batch_id,
      shelfLifeResult.mktCelsius,
      shelfLifeResult.consumedFraction,
      shelfLifeResult.remainingLifeHours,
      getUtcTimestamp(),
    ]
  );

  // 5. Evaluate thresholds and raise deterministic alerts
  let alertCount = 0;
  for (const reading of currentReadings) {
    const violations = checkThresholds(reading, profile, shelfLifeResult.remainingLifeHours);
    for (const v of violations) {
      const alertId = `alt-${crypto.randomUUID()}`;
      await db.query(
        `INSERT INTO alerts (alert_id, shipment_id, type, severity, source, acknowledged_by, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          alertId,
          shipment_id,
          v.type,
          v.severity,
          'deterministic',
          null,
          v.message,
          getUtcTimestamp(),
        ]
      );
      alertCount++;
    }
  }

  return {
    mkt: shelfLifeResult.mktCelsius,
    remainingLife: shelfLifeResult.remainingLifeHours,
    alertCount,
  };
}
