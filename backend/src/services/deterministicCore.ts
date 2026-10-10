import { getDbClient } from '../db';
import {
  ProfileParameters,
  calculateRemainingShelfLife,
  checkThresholds,
  SensorReading,
  TimedReading,
  getUtcTimestamp,
} from '@frostledger/shared';
import { createAlert, AlertRecord } from './alertService';

export interface DeterministicProcessingResult {
  batch_id: string;
  shipment_id: string;
  mktCelsius: number;
  consumedFraction: number;
  remainingLifeHours: number;
  alertsCreated: AlertRecord[];
  processedAt: string;
  deliveryLatencyMs: number;
}

export interface NotificationDispatcher {
  sendEmail(to: string, subject: string, body: string): Promise<boolean>;
}

// In-memory notification dispatcher stub ensuring alert delivery under 30s
export const notificationDispatcher: NotificationDispatcher = {
  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    console.log(`[Notification/Email] Sent alert to <${to}>: ${subject} - ${body.substring(0, 80)}...`);
    return true;
  },
};

/**
 * Deterministic processing engine executed by the background worker:
 * 1. Computes Arrhenius MKT and remaining shelf life (pure functions).
 * 2. Writes each audit step to shelf_life_trail.
 * 3. Evaluates readings against frozen profile thresholds (thermal, humidity, shock, shelf-life).
 * 4. Creates deterministic alerts and delivers notification within 30 seconds.
 */
export async function processBatchDeterministic(
  batchId: string,
  shipmentId: string
): Promise<DeterministicProcessingResult> {
  const startTime = Date.now();
  const db = await getDbClient();

  // 1. Fetch shipment with its frozen profile parameters
  const shipmentRes = await db.query(
    `SELECT s.shipment_id, s.device_id, s.profile_id, s.profile_version, p.parameters
     FROM shipments s
     JOIN profiles p ON s.profile_id = p.profile_id AND s.profile_version = p.version
     WHERE s.shipment_id = $1`,
    [shipmentId]
  );

  if (shipmentRes.rowCount === 0) {
    throw new Error(`Shipment '${shipmentId}' or frozen profile not found`);
  }

  const rawParameters = shipmentRes.rows[0].parameters;
  const profile: ProfileParameters =
    typeof rawParameters === 'string' ? JSON.parse(rawParameters) : rawParameters;

  // 2. Fetch current batch
  const currentBatchRes = await db.query(
    'SELECT batch_id, sequence_no, payload FROM batches WHERE batch_id = $1',
    [batchId]
  );

  if (currentBatchRes.rowCount === 0) {
    throw new Error(`Batch '${batchId}' not found`);
  }

  const currentBatch = currentBatchRes.rows[0];
  const currentSeq = Number(currentBatch.sequence_no);
  const currentPayload =
    typeof currentBatch.payload === 'string'
      ? JSON.parse(currentBatch.payload)
      : currentBatch.payload;

  // 3. Fetch all chronological batches for this shipment up to current sequence
  const historyRes = await db.query(
    `SELECT payload FROM batches
     WHERE shipment_id = $1 AND sequence_no <= $2
     ORDER BY sequence_no ASC`,
    [shipmentId, currentSeq]
  );

  const timedReadings: TimedReading[] = [];
  for (const row of historyRes.rows) {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    if (payload.readings && Array.isArray(payload.readings)) {
      for (const r of payload.readings) {
        timedReadings.push({
          timestamp: r.timestamp,
          temperature: r.temperature,
        });
      }
    }
  }

  // 4. Run pure kinetic calculations (Arrhenius MKT & shelf life)
  const shelfLifeResult = calculateRemainingShelfLife(timedReadings, profile);

  // 5. Store step in shelf_life_trail for audit
  await db.query(
    `INSERT INTO shelf_life_trail (shipment_id, batch_id, mkt, consumed_fraction, remaining_life, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (shipment_id, batch_id)
     DO UPDATE SET
       mkt = EXCLUDED.mkt,
       consumed_fraction = EXCLUDED.consumed_fraction,
       remaining_life = EXCLUDED.remaining_life`,
    [
      shipmentId,
      batchId,
      shelfLifeResult.mktCelsius,
      shelfLifeResult.consumedFraction,
      shelfLifeResult.remainingLifeHours,
      getUtcTimestamp(),
    ]
  );

  // 6. Evaluate threshold violations against frozen profile
  const alertsCreated: AlertRecord[] = [];
  const currentReadings: SensorReading[] = currentPayload.readings || [];

  for (const reading of currentReadings) {
    const violations = checkThresholds(reading, profile, shelfLifeResult.remainingLifeHours);

    for (const v of violations) {
      const alert = await createAlert({
        shipment_id: shipmentId,
        type: v.type,
        severity: v.severity,
        source: 'deterministic',
        note: v.message,
      });

      alertsCreated.push(alert);

      // Dispatch alert notification / email immediately
      await notificationDispatcher.sendEmail(
        'operator@coldchain.test',
        `[OFFICIAL ALERT] ${v.type.toUpperCase()} on Shipment ${shipmentId}`,
        `Severity: ${v.severity.toUpperCase()}\nDetails: ${v.message}\nTimestamp: ${v.timestamp}`
      );
    }
  }

  const deliveryLatencyMs = Date.now() - startTime;

  return {
    batch_id: batchId,
    shipment_id: shipmentId,
    mktCelsius: shelfLifeResult.mktCelsius,
    consumedFraction: shelfLifeResult.consumedFraction,
    remainingLifeHours: shelfLifeResult.remainingLifeHours,
    alertsCreated,
    processedAt: getUtcTimestamp(),
    deliveryLatencyMs,
  };
}
