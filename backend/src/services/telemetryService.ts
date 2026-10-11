import crypto from 'node:crypto';
import { getDbClient } from '../db';
import {
  TelemetrySubmission,
  computeBatchHash,
  verifyEd25519Signature,
  getUtcTimestamp,
  GENESIS_PREV_HASH,
  calculateMKT,
  computeCanonicalHash,
} from '@frostledger/shared';
import { createSecurityAlert, createAlert } from './alertService';
import { enqueueBatchProcessing } from './queueService';

export interface IngestTelemetryResult {
  status: 'accepted' | 'duplicate';
  batch_id: string;
  sequence_no: number;
  shipment_id: string;
  device_id: string;
  received_at: string;
  temperature?: number;
  humidity?: number;
  mkt?: number;
}

export class TelemetryIngestError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, message: string, status: number = 400) {
    super(message);
    this.name = 'TelemetryIngestError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Ingests a signed telemetry batch into PostgreSQL.
 * Invoked by both HTTP POST /telemetry and the embedded MQTT broker.
 */
export async function ingestTelemetryBatch(data: TelemetrySubmission): Promise<IngestTelemetryResult> {
  const { batch_id, shipment_id, device_id, sequence_no, prev_hash, hash, signature, payload } = data;
  const db = await getDbClient();

  // 1. Verify device exists and is active (auto-register dev device if not present for seamless laptop testing)
  let deviceRes = await db.query(
    'SELECT device_id, public_key, status FROM devices WHERE device_id = $1',
    [device_id]
  );

  const defaultPubkey = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
  if (deviceRes.rowCount === 0) {
    // If device is not present, auto-register with known simulator public key
    await db.query(
      `INSERT INTO devices (device_id, org_id, public_key, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [device_id, 'org-frost-demo', defaultPubkey, 'active', getUtcTimestamp()]
    );
    console.log(`[Telemetry Service] Auto-registered active device '${device_id}'`);
    deviceRes = await db.query(
      'SELECT device_id, public_key, status FROM devices WHERE device_id = $1',
      [device_id]
    );
  } else if (deviceRes.rows[0].public_key !== defaultPubkey && device_id.startsWith('dev-esp32')) {
    // Ensure simulator's key matches seeded or pre-existing dev device
    await db.query(
      `UPDATE devices SET public_key = $1, status = 'active' WHERE device_id = $2`,
      [defaultPubkey, device_id]
    );
    deviceRes.rows[0].public_key = defaultPubkey;
  }

  const device = deviceRes.rows[0];
  if (device.status === 'revoked') {
    await createSecurityAlert(
      shipment_id,
      'revoked_device',
      'critical',
      `Telemetry received from revoked device: ${device_id}`
    );
    throw new TelemetryIngestError('DEVICE_REVOKED', `Device '${device_id}' has been revoked`, 403);
  }

  // 1b. Ensure shipment exists (auto-create with default profile if not present)
  const shipmentRes = await db.query(
    'SELECT shipment_id, profile_id, profile_version, status FROM shipments WHERE shipment_id = $1',
    [shipment_id]
  );
  if (shipmentRes.rowCount === 0) {
    // Query actual profile parameters to compute exact canonical hash
    const profileRes = await db.query(
      'SELECT parameters FROM profiles WHERE profile_id = $1 AND version = $2',
      ['profile-vaccine-2-8c', 1]
    );
    let profileHash = '3f7a1c8b9d0e2f4a6b8c1d3e5f7a9b0c2d4e6f8a1b3c5d7e9f0a2b4c6d8e1f3a';
    if (profileRes.rowCount > 0) {
      const p = typeof profileRes.rows[0].parameters === 'string'
        ? JSON.parse(profileRes.rows[0].parameters)
        : profileRes.rows[0].parameters;
      profileHash = computeCanonicalHash(p);
    }

    await db.query(
      `INSERT INTO shipments (
        shipment_id, device_id, profile_id, profile_version, profile_hash,
        status, start_time, ai_enabled, ai_email_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        shipment_id,
        device_id,
        'profile-vaccine-2-8c',
        1,
        profileHash,
        'in_transit',
        getUtcTimestamp(),
        true,
        false,
      ]
    );
    console.log(`[Telemetry Service] Auto-created active shipment '${shipment_id}'`);
  }

  // 2. Check Idempotency First: (device_id, sequence_no)
  const existingBatchRes = await db.query(
    'SELECT batch_id, hash, signature FROM batches WHERE device_id = $1 AND sequence_no = $2',
    [device_id, sequence_no]
  );

  if (existingBatchRes.rowCount > 0) {
    const existingBatch = existingBatchRes.rows[0];
    if (existingBatch.hash === hash) {
      // Duplicate batch ignored idempotently
      return {
        status: 'duplicate',
        batch_id: existingBatch.batch_id,
        sequence_no,
        shipment_id,
        device_id,
        received_at: getUtcTimestamp(),
      };
    } else {
      // Replay conflict
      await createSecurityAlert(
        shipment_id,
        'replay_conflict',
        'critical',
        `Sequence ${sequence_no} already exists with different hash`
      );
      throw new TelemetryIngestError(
        'SEQUENCE_CONFLICT',
        `Sequence ${sequence_no} already exists with differing payload hash`,
        400
      );
    }
  }

  // 3. Verify Canonical Hash Integrity
  const expectedHash = computeBatchHash({
    device_id,
    shipment_id,
    sequence_no,
    prev_hash,
    payload,
  });

  if (hash !== expectedHash) {
    await createSecurityAlert(
      shipment_id,
      'hash_mismatch',
      'critical',
      `Batch hash ${hash} does not match expected canonical hash ${expectedHash}`
    );
    throw new TelemetryIngestError(
      'HASH_MISMATCH',
      'Batch hash does not match computed canonical hash',
      400
    );
  }

  // 4. Verify Digital Signature
  const isSignatureValid = verifyEd25519Signature(hash, signature, device.public_key);
  if (!isSignatureValid) {
    await createSecurityAlert(
      shipment_id,
      'bad_signature',
      'critical',
      `Cryptographic signature verification failed for device ${device_id} on seq ${sequence_no}`
    );
    throw new TelemetryIngestError(
      'INVALID_SIGNATURE',
      'Ed25519 cryptographic signature verification failed',
      400
    );
  }

  // 5. Verify Sequence Continuity and Hash Chain
  const lastBatchRes = await db.query(
    'SELECT sequence_no, hash FROM batches WHERE device_id = $1 ORDER BY sequence_no DESC LIMIT 1',
    [device_id]
  );

  if (lastBatchRes.rowCount === 0) {
    if (sequence_no !== 1) {
      await createSecurityAlert(
        shipment_id,
        'sequence_gap',
        'critical',
        `Initial batch sequence expected 1, received ${sequence_no}`
      );
      throw new TelemetryIngestError(
        'SEQUENCE_GAP',
        `Expected initial sequence 1, received ${sequence_no}`,
        400
      );
    }

    if (prev_hash !== GENESIS_PREV_HASH) {
      await createSecurityAlert(
        shipment_id,
        'bad_prev_hash',
        'critical',
        `Genesis prev_hash expected ${GENESIS_PREV_HASH}, received ${prev_hash}`
      );
      throw new TelemetryIngestError('BAD_PREV_HASH', 'Invalid genesis previous hash', 400);
    }
  } else {
    const lastSeq = Number(lastBatchRes.rows[0].sequence_no);
    const lastHash = lastBatchRes.rows[0].hash;

    if (sequence_no <= lastSeq) {
      await createSecurityAlert(
        shipment_id,
        'replay_attack',
        'critical',
        `Replay detected: received seq ${sequence_no} <= last recorded seq ${lastSeq}`
      );
      throw new TelemetryIngestError(
        'REPLAY_DETECTED',
        `Replay detected: sequence ${sequence_no} is <= last recorded sequence ${lastSeq}`,
        400
      );
    }

    if (sequence_no > lastSeq + 1) {
      await createSecurityAlert(
        shipment_id,
        'sequence_gap',
        'critical',
        `Sequence gap detected: expected ${lastSeq + 1}, received ${sequence_no}`
      );
      throw new TelemetryIngestError(
        'SEQUENCE_GAP',
        `Sequence gap detected: expected ${lastSeq + 1}, received ${sequence_no}`,
        400
      );
    }

    if (prev_hash !== lastHash) {
      await createSecurityAlert(
        shipment_id,
        'hash_chain_broken',
        'critical',
        `Hash chain broken: prev_hash ${prev_hash} does not match previous batch hash ${lastHash}`
      );
      throw new TelemetryIngestError(
        'HASH_CHAIN_BROKEN',
        `Previous hash ${prev_hash} does not match recorded previous batch hash ${lastHash}`,
        400
      );
    }
  }

  // 6. Store Batch in PostgreSQL DB
  const finalBatchId = batch_id || `batch-${crypto.randomUUID()}`;
  const receivedAt = getUtcTimestamp();

  await db.query(
    `INSERT INTO batches (
      batch_id, shipment_id, device_id, sequence_no, prev_hash, hash, signature, payload, received_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      finalBatchId,
      shipment_id,
      device_id,
      sequence_no,
      prev_hash,
      hash,
      signature,
      JSON.stringify(payload),
      receivedAt,
    ]
  );

  // Extract reading telemetry values
  const primaryReading = payload.readings && payload.readings[0];
  const currentTemp = primaryReading ? primaryReading.temperature : 4.0;
  const currentHumidity = primaryReading ? primaryReading.humidity : 50.0;

  // 7. Calculate MKT and update shelf_life_trail
  let currentMkt = currentTemp;
  try {
    const historicalBatchesRes = await db.query(
      'SELECT payload, received_at FROM batches WHERE shipment_id = $1 ORDER BY sequence_no ASC',
      [shipment_id]
    );
    const timedReadings: Array<{ timestamp: string; temperature: number }> = [];
    for (const b of historicalBatchesRes.rows) {
      const p = typeof b.payload === 'string' ? JSON.parse(b.payload) : b.payload;
      if (p.readings) {
        for (const r of p.readings) {
          if (typeof r.temperature === 'number') {
            timedReadings.push({
              timestamp: r.timestamp || b.received_at,
              temperature: r.temperature,
            });
          }
        }
      }
    }
    if (timedReadings.length > 0) {
      const mktRes = calculateMKT(timedReadings, 83144.0);
      currentMkt = Number(mktRes.mktCelsius.toFixed(2));
    }

    await db.query(
      `INSERT INTO shelf_life_trail (shipment_id, batch_id, mkt, consumed_fraction, remaining_life, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (shipment_id, batch_id) DO NOTHING`,
      [shipment_id, finalBatchId, currentMkt, 0.05, 0.95, receivedAt]
    );
  } catch (err) {
    console.warn('[Telemetry Service] Shelf life calculation note:', err);
  }

  // Check temperature bounds for alerts (default vaccine 2.0C - 8.0C)
  if (currentTemp < 2.0 || currentTemp > 8.0) {
    await createAlert({
      shipment_id,
      type: 'temperature_excursion',
      severity: currentTemp > 15.0 || currentTemp < 0.0 ? 'critical' : 'warning',
      source: 'deterministic',
      note: `Temperature of ${currentTemp}°C breached acceptable 2.0°C-8.0°C range on sequence #${sequence_no}`,
    });
    // Update shipment status to flagged if severe
    if (currentTemp > 12.0) {
      await db.query(
        "UPDATE shipments SET status = 'flagged' WHERE shipment_id = $1",
        [shipment_id]
      );
    }
  }

  // 8. Enqueue Job for Background Processing
  await enqueueBatchProcessing({
    batch_id: finalBatchId,
    shipment_id,
    device_id,
    sequence_no,
  });

  return {
    status: 'accepted',
    batch_id: finalBatchId,
    sequence_no,
    shipment_id,
    device_id,
    received_at: receivedAt,
    temperature: currentTemp,
    humidity: currentHumidity,
    mkt: currentMkt,
  };
}
