import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDbClient } from '../db';
import {
  TelemetrySubmissionSchema,
  EventSubmissionSchema,
  computeBatchHash,
  verifyEd25519Signature,
  getUtcTimestamp,
  createErrorResponse,
  GENESIS_PREV_HASH,
} from '@frostledger/shared';
import { validateBody } from '../middleware/validate';
import { authenticateWebhook } from '../middleware/webhookAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { createSecurityAlert } from '../services/alertService';
import { enqueueBatchProcessing } from '../services/queueService';

const router = Router();

/**
 * POST /telemetry
 * Ingests signed batches forwarded by MQTT broker webhook.
 * Enforces:
 *  - Device existence and active status
 *  - Idempotent deduplication (same batch again succeeds)
 *  - Canonical hash integrity
 *  - Ed25519 digital signature
 *  - Sequence continuity (exactly last + 1)
 *  - Hash-chain integrity (prev_hash matches previous batch)
 *  - Creates security alerts on any tampering/forgery/gap
 *  - Enqueues background worker job on success
 */
router.post(
  '/telemetry',
  authenticateWebhook,
  validateBody(TelemetrySubmissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { batch_id, shipment_id, device_id, sequence_no, prev_hash, hash, signature, payload } = req.body;
    const db = await getDbClient();

    // 1. Verify device exists and is not revoked
    const deviceRes = await db.query(
      'SELECT device_id, public_key, status FROM devices WHERE device_id = $1',
      [device_id]
    );

    if (deviceRes.rowCount === 0) {
      await createSecurityAlert(
        shipment_id,
        'unknown_device',
        'critical',
        `Telemetry received for unregistered device: ${device_id}`
      );
      return res
        .status(400)
        .json(createErrorResponse('UNKNOWN_DEVICE', `Device '${device_id}' does not exist`));
    }

    const device = deviceRes.rows[0];
    if (device.status === 'revoked') {
      await createSecurityAlert(
        shipment_id,
        'revoked_device',
        'critical',
        `Telemetry received from revoked device: ${device_id}`
      );
      return res
        .status(403)
        .json(createErrorResponse('DEVICE_REVOKED', `Device '${device_id}' has been revoked`));
    }

    // 2. Check Idempotency First: (device_id, sequence_no)
    const existingBatchRes = await db.query(
      'SELECT batch_id, hash, signature FROM batches WHERE device_id = $1 AND sequence_no = $2',
      [device_id, sequence_no]
    );

    if (existingBatchRes.rowCount > 0) {
      const existingBatch = existingBatchRes.rows[0];
      if (existingBatch.hash === hash) {
        // Same batch delivered again: store once and return success (idempotent)
        return res.status(200).json({
          message: 'Duplicate batch ignored without error (idempotent)',
          batch_id: existingBatch.batch_id,
          sequence_no,
          status: 'duplicate',
        });
      } else {
        // Same sequence number with conflicting hash: replay tampering
        await createSecurityAlert(
          shipment_id,
          'replay_conflict',
          'critical',
          `Sequence ${sequence_no} already exists with different hash`
        );
        return res
          .status(400)
          .json(
            createErrorResponse(
              'SEQUENCE_CONFLICT',
              `Sequence ${sequence_no} already exists with differing payload hash`
            )
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
      return res
        .status(400)
        .json(createErrorResponse('HASH_MISMATCH', 'Batch hash does not match computed canonical hash'));
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
      return res
        .status(400)
        .json(createErrorResponse('INVALID_SIGNATURE', 'Ed25519 cryptographic signature verification failed'));
    }

    // 5. Verify Sequence Continuity and Hash Chain
    const lastBatchRes = await db.query(
      'SELECT sequence_no, hash FROM batches WHERE device_id = $1 ORDER BY sequence_no DESC LIMIT 1',
      [device_id]
    );

    if (lastBatchRes.rowCount === 0) {
      // First batch for this device: sequence must be 1, prev_hash must be genesis
      if (sequence_no !== 1) {
        await createSecurityAlert(
          shipment_id,
          'sequence_gap',
          'critical',
          `Initial batch sequence expected 1, received ${sequence_no}`
        );
        return res
          .status(400)
          .json(createErrorResponse('SEQUENCE_GAP', `Expected initial sequence 1, received ${sequence_no}`));
      }

      if (prev_hash !== GENESIS_PREV_HASH) {
        await createSecurityAlert(
          shipment_id,
          'bad_prev_hash',
          'critical',
          `Genesis prev_hash expected ${GENESIS_PREV_HASH}, received ${prev_hash}`
        );
        return res
          .status(400)
          .json(createErrorResponse('BAD_PREV_HASH', 'Invalid genesis previous hash'));
      }
    } else {
      const lastSeq = Number(lastBatchRes.rows[0].sequence_no);
      const lastHash = lastBatchRes.rows[0].hash;

      if (sequence_no <= lastSeq) {
        // Replay attack with older sequence
        await createSecurityAlert(
          shipment_id,
          'replay_attack',
          'critical',
          `Replay detected: received seq ${sequence_no} <= last recorded seq ${lastSeq}`
        );
        return res
          .status(400)
          .json(
            createErrorResponse(
              'REPLAY_DETECTED',
              `Replay detected: sequence ${sequence_no} is less than or equal to last recorded sequence ${lastSeq}`
            )
          );
      }

      if (sequence_no > lastSeq + 1) {
        // Sequence gap detected
        await createSecurityAlert(
          shipment_id,
          'sequence_gap',
          'critical',
          `Sequence gap detected: expected ${lastSeq + 1}, received ${sequence_no}`
        );
        return res
          .status(400)
          .json(
            createErrorResponse(
              'SEQUENCE_GAP',
              `Sequence gap detected: expected ${lastSeq + 1}, received ${sequence_no}`
            )
          );
      }

      if (prev_hash !== lastHash) {
        // Hash chain broken
        await createSecurityAlert(
          shipment_id,
          'hash_chain_broken',
          'critical',
          `Hash chain broken: prev_hash ${prev_hash} does not match previous batch hash ${lastHash}`
        );
        return res
          .status(400)
          .json(
            createErrorResponse(
              'HASH_CHAIN_BROKEN',
              `Previous hash ${prev_hash} does not match recorded previous batch hash ${lastHash}`
            )
          );
      }
    }

    // 6. Store Batch
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

    // 7. Enqueue Job for the background worker
    await enqueueBatchProcessing({
      batch_id: finalBatchId,
      shipment_id,
      device_id,
      sequence_no,
    });

    return res.status(201).json({
      message: 'Batch accepted and stored successfully',
      batch_id: finalBatchId,
      sequence_no,
      status: 'accepted',
      received_at: receivedAt,
    });
  })
);

/**
 * POST /events
 * Ingests physical handling events (shock, tilt, door-open)
 */
router.post(
  '/events',
  authenticateWebhook,
  validateBody(EventSubmissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { event_id, shipment_id, type, magnitude, timestamp } = req.body;
    const db = await getDbClient();

    const finalEventId = event_id || `evt-${crypto.randomUUID()}`;

    await db.query(
      `INSERT INTO events (event_id, shipment_id, type, magnitude, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [finalEventId, shipment_id, type, magnitude, timestamp]
    );

    return res.status(201).json({
      message: 'Event recorded successfully',
      event_id: finalEventId,
      shipment_id,
      type,
      magnitude,
      timestamp,
    });
  })
);

export default router;
